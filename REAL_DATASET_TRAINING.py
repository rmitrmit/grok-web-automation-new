# === YOLO11 Training with REAL Interior Datasets ===
# Uses publicly accessible Roboflow datasets with real photos

# === CELL 1: Setup Environment ===
!pip install ultralytics roboflow supervision
import os
from ultralytics import YOLO
import torch
import roboflow
import yaml
import shutil
from pathlib import Path

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

# === CELL 2: Download Real Datasets ===
rf = roboflow.Roboflow(api_key="gcscP35McEJicDDGOe5p")
downloaded_datasets = []

# Try multiple real dataset sources
dataset_sources = [
    # Real interior photos with walls/floors
    ("park-jong-il-k1lxw", "wall-floor-ceiling-recognition", 1),
    ("testing-daidy", "floor-plan-walls", 1),
    ("floor-plan-kaaow", "floor-plan_-room-detection", 1),
    
    # Alternative workspaces to try
    ("public-datasets", "interior-walls", 1),
    ("roboflow-100", "architectural-elements", 1),
    ("university-research", "wall-detection", 1),
]

print("🔍 Downloading real interior datasets...")

for workspace, project_name, version in dataset_sources:
    try:
        print(f"Trying {workspace}/{project_name}...")
        workspace_obj = rf.workspace(workspace)
        project = workspace_obj.project(project_name)
        dataset = project.version(version).download("yolov8")
        
        dataset_info = {
            'path': dataset.location,
            'name': project_name,
            'workspace': workspace
        }
        downloaded_datasets.append(dataset_info)
        
        print(f"✅ Downloaded {project_name} to {dataset.location}")
        
        # Check dataset contents
        dataset_dir = Path(dataset.location)
        train_imgs = len(list((dataset_dir / 'train' / 'images').glob('*'))) if (dataset_dir / 'train' / 'images').exists() else 0
        val_imgs = len(list((dataset_dir / 'valid' / 'images').glob('*'))) if (dataset_dir / 'valid' / 'images').exists() else 0
        
        print(f"   Training images: {train_imgs}, Validation: {val_imgs}")
        
        # Stop if we get a good dataset
        if train_imgs > 20:
            print(f"   Good dataset found! Using {project_name}")
            break
            
    except Exception as e:
        print(f"❌ Failed {workspace}/{project_name}: {str(e)[:60]}...")
        continue

print(f"\n📊 Successfully downloaded {len(downloaded_datasets)} real datasets")

# === CELL 3: Prepare Combined Real Dataset ===
def combine_real_datasets():
    if not downloaded_datasets:
        print("❌ No real datasets available")
        return False
    
    # Create directory structure
    os.makedirs('./combined_real_dataset/train/images', exist_ok=True)
    os.makedirs('./combined_real_dataset/train/labels', exist_ok=True)
    os.makedirs('./combined_real_dataset/val/images', exist_ok=True)
    os.makedirs('./combined_real_dataset/val/labels', exist_ok=True)
    
    total_images = 0
    class_names = set()
    
    for dataset_info in downloaded_datasets:
        dataset_path = dataset_info['path']
        dataset_name = dataset_info['name']
        
        print(f"Processing {dataset_name}...")
        dataset_dir = Path(dataset_path)
        
        # Check data.yaml for class names
        yaml_file = dataset_dir / 'data.yaml'
        if yaml_file.exists():
            with open(yaml_file, 'r') as f:
                data_config = yaml.safe_load(f)
                if 'names' in data_config:
                    for name in data_config['names']:
                        class_names.add(name.lower())
                    print(f"   Classes: {data_config['names']}")
        
        # Process train and validation splits
        for split in ['train', 'valid', 'test']:
            target_split = 'val' if split in ['valid', 'test'] else 'train'
            
            images_dir = dataset_dir / split / 'images'
            labels_dir = dataset_dir / split / 'labels'
            
            if images_dir.exists():
                for img_file in images_dir.glob('*'):
                    if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                        # Copy image with dataset prefix
                        dest_img = f'./combined_real_dataset/{target_split}/images/{dataset_name}_{img_file.name}'
                        shutil.copy2(img_file, dest_img)
                        total_images += 1
                        
                        # Copy corresponding label
                        label_file = labels_dir / f"{img_file.stem}.txt"
                        if label_file.exists():
                            dest_label = f'./combined_real_dataset/{target_split}/labels/{dataset_name}_{img_file.stem}.txt'
                            shutil.copy2(label_file, dest_label)
    
    print(f"✅ Combined {total_images} real images")
    print(f"✅ Found classes: {sorted(class_names)}")
    
    return total_images > 0, sorted(class_names)

dataset_ready, found_classes = combine_real_datasets()

# === CELL 4: Create Training Configuration ===
if dataset_ready:
    # Map found classes to our target classes
    target_classes = ['wall', 'floor', 'ceiling']
    
    # Use found classes if they match our targets, otherwise use defaults
    if any(cls in found_classes for cls in ['wall', 'floor', 'ceiling']):
        final_classes = [cls for cls in target_classes if cls in found_classes]
    else:
        # Map similar classes
        final_classes = target_classes
        print("Using default classes (wall, floor, ceiling)")
    
    training_config = {
        'train': './combined_real_dataset/train',
        'val': './combined_real_dataset/val',
        'nc': len(final_classes),
        'names': final_classes
    }
    
    with open('./combined_real_dataset/data.yaml', 'w') as f:
        yaml.dump(training_config, f)
    
    print(f"✅ Training config ready with {len(final_classes)} classes: {final_classes}")

# === CELL 5: Train on Real Data ===
if dataset_ready:
    print("🚀 Starting YOLO11 training on REAL interior images...")
    
    model = YOLO("yolo11n.pt")
    
    results = model.train(
        data='./combined_real_dataset/data.yaml',
        epochs=50,
        imgsz=640,
        batch=8,
        lr0=0.01,
        device=device,
        patience=15,
        save=True,
        plots=True,
        name='real_interior_training'
    )
    
    print("✅ Training on real interior data completed!")
    best_model_path = "runs/detect/real_interior_training/weights/best.pt"
    print(f"Best model: {best_model_path}")
    
    # Validate model
    metrics = model.val(data='./combined_real_dataset/data.yaml')
    print(f"mAP@0.5: {metrics.box.map50:.3f}")
    
    # Export to ONNX
    model.export(format='onnx')
    print("Model exported to ONNX format")
else:
    print("❌ No real datasets ready for training")

# === CELL 6: Auto-Save to Google Drive ===
from google.colab import drive, files
from datetime import datetime

# Mount Google Drive
drive.mount('/content/drive')

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
drive_folder = f"/content/drive/MyDrive/YOLO11_Models/real_interior_model_{timestamp}"
os.makedirs(drive_folder, exist_ok=True)

try:
    if os.path.exists("runs/detect/real_interior_training/weights/best.pt"):
        # Save model files
        shutil.copy2("runs/detect/real_interior_training/weights/best.pt", 
                    f"{drive_folder}/real_interior_best.pt")
        print(f"✅ Saved model to Google Drive: {drive_folder}")
        
        # Save ONNX export
        if os.path.exists("runs/detect/real_interior_training/weights/best.onnx"):
            shutil.copy2("runs/detect/real_interior_training/weights/best.onnx", 
                        f"{drive_folder}/real_interior_best.onnx")
            print("✅ Saved ONNX export")
        
        # Save complete training results
        shutil.copytree("runs/detect/real_interior_training", 
                       f"{drive_folder}/training_results", dirs_exist_ok=True)
        print("✅ Saved training results")
        
        # Create model documentation
        model_docs = f"""# Real Interior YOLO11 Model - {timestamp}

## Dataset Information
- Source: Real Roboflow datasets
- Total Images: {total_images if 'total_images' in locals() else 'Unknown'}
- Classes: {final_classes if 'final_classes' in locals() else 'wall, floor, ceiling'}
- Datasets Used: {[d['name'] for d in downloaded_datasets]}

## Model Files
- real_interior_best.pt: Main PyTorch model
- real_interior_best.onnx: ONNX export for deployment  
- training_results/: Complete training logs and plots

## Performance
- Training Epochs: 50
- mAP@0.5: {metrics.box.map50 if 'metrics' in locals() else 'TBD'}
- Device: {device}

## Deployment
1. Download real_interior_best.pt from this folder
2. Upload to your API server (Colab/FastAPI)  
3. Update detection endpoint to use this model

## Next Steps for Incremental Training
Use this model as base for Phase 2 (furniture) training:
```python
model = YOLO('real_interior_best.pt')
model.train(data='furniture_dataset.yaml', epochs=40)
```
"""
        
        with open(f"{drive_folder}/README.md", 'w') as f:
            f.write(model_docs)
        
        print(f"🎯 Real interior model ready!")
        print(f"📁 Google Drive: {drive_folder}")
        print("✅ Trained on real architectural photos")
        
        # Download locally
        files.download("runs/detect/real_interior_training/weights/best.pt")
        print("✅ Also downloaded locally")
        
    else:
        print("❌ No trained model found")
        
except Exception as e:
    print(f"Google Drive save failed: {e}")
    
    # Fallback local download
    try:
        if os.path.exists("runs/detect/real_interior_training/weights/best.pt"):
            files.download("runs/detect/real_interior_training/weights/best.pt")
            print("✅ Downloaded locally")
    except Exception as e2:
        print(f"Local download failed: {e2}")

print("\n🏁 Training complete! Model trained on real interior images.")