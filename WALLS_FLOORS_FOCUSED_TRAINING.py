# === YOLO11 Walls & Floors Focused Training ===
# Quick 2-3 hour training for essential structural elements

# === CELL 1: Setup Environment ===
!pip install ultralytics roboflow supervision
import os
import torch
import roboflow
import yaml
import shutil
from pathlib import Path
from ultralytics import YOLO

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

# === CELL 2: Download Available Datasets (Multiple Sources) ===
rf = roboflow.Roboflow(api_key="gcscP35McEJicDDGOe5p")

walls_floors_path = None
downloaded_datasets = []

# Try multiple dataset sources for walls/floors
dataset_sources = [
    ("adriangracz", "floor-and-wall-detection", 1),
    ("simproject-yyhtk", "wall-floor-ceiling", 1),  
    ("roboflow-100", "ceiling-wall-floor", 1),
    ("objectdetectionproject-v6qyk", "wall-floor-detection", 1)
]

print("Searching for available walls/floors datasets...")

for workspace, project_name, version in dataset_sources:
    try:
        project = rf.workspace(workspace).project(project_name)
        dataset = project.version(version).download("yolov8")
        walls_floors_path = dataset.location
        downloaded_datasets.append(dataset.location)
        print(f"✅ Downloaded {project_name} from {workspace} to {walls_floors_path}")
        
        # Check dataset structure
        dataset_dir = Path(walls_floors_path)
        train_count = len(list((dataset_dir / 'train' / 'images').glob('*'))) if (dataset_dir / 'train' / 'images').exists() else 0
        val_count = len(list((dataset_dir / 'valid' / 'images').glob('*'))) if (dataset_dir / 'valid' / 'images').exists() else 0
        print(f"Training images: {train_count}, Validation images: {val_count}")
        
        if train_count > 10:  # Need minimum images for training
            break
            
    except Exception as e:
        print(f"❌ Failed to download {project_name}: {e}")
        continue

if not walls_floors_path:
    print("⚠️ No datasets available, creating synthetic training data...")
    # Create basic structure to prevent file errors
    os.makedirs('./walls_floors_dataset/train/images', exist_ok=True)
    os.makedirs('./walls_floors_dataset/train/labels', exist_ok=True)
    os.makedirs('./walls_floors_dataset/val/images', exist_ok=True)
    os.makedirs('./walls_floors_dataset/val/labels', exist_ok=True)
    
    # Create synthetic room images for testing
    import cv2
    import numpy as np
    
    for i in range(50):  # Create 50 synthetic images for better training
        # Create simple room layout
        img = np.zeros((416, 416, 3), dtype=np.uint8)
        
        # Floor (bottom 40%)
        floor_y = int(416 * 0.6)
        img[floor_y:416, :] = [139, 69, 19]  # Brown floor
        
        # Walls (top 60%)
        img[0:floor_y, :] = [245, 245, 220]  # Beige walls
        
        # Add ceiling line (top 10%)
        ceiling_y = int(416 * 0.1)
        img[0:ceiling_y, :] = [255, 255, 255]  # White ceiling
        
        # Add some realistic variation
        noise = np.random.randint(-15, 15, img.shape, dtype=np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        
        # Add some furniture-like rectangles for realism
        if np.random.random() > 0.5:
            x1, y1 = np.random.randint(50, 200), np.random.randint(250, 350)
            x2, y2 = x1 + np.random.randint(30, 100), y1 + np.random.randint(20, 60)
            cv2.rectangle(img, (x1, y1), (x2, y2), (101, 67, 33), -1)  # Dark brown furniture
        
        # Save image
        split = 'train' if i < 40 else 'val'
        cv2.imwrite(f'./walls_floors_dataset/{split}/images/room_{i:03d}.jpg', img)
        
        # Create YOLO labels (normalized coordinates)
        # Wall: top 60% of image
        wall_box = "0 0.5 0.3 1.0 0.6\n"  # class_id x_center y_center width height
        # Floor: bottom 40% of image  
        floor_box = "1 0.5 0.8 1.0 0.4\n"
        # Ceiling: top 10% of image
        ceiling_box = "2 0.5 0.05 1.0 0.1\n"
        
        with open(f'./walls_floors_dataset/{split}/labels/room_{i:03d}.txt', 'w') as f:
            f.write(wall_box + floor_box + ceiling_box)
    
    print("✅ Created 50 synthetic room images for training")
    walls_floors_path = "./walls_floors_dataset"  # Set path for training

# === CELL 3: Prepare Focused Dataset ===
def prepare_walls_floors_dataset():
    # Always create directories to prevent file errors
    os.makedirs('./walls_floors_dataset/train/images', exist_ok=True)
    os.makedirs('./walls_floors_dataset/train/labels', exist_ok=True)
    os.makedirs('./walls_floors_dataset/val/images', exist_ok=True)
    os.makedirs('./walls_floors_dataset/val/labels', exist_ok=True)
    
    if not walls_floors_path:
        print("⚠️ No dataset downloaded, creating minimal structure")
        # Create empty label files to prevent training errors
        with open('./walls_floors_dataset/train/labels/.gitkeep', 'w') as f:
            f.write('')
        with open('./walls_floors_dataset/val/labels/.gitkeep', 'w') as f:
            f.write('')
        return False
        
    dataset_dir = Path(walls_floors_path)
    total_count = 0
    
    # Copy training data from downloaded datasets
    for split in ['train', 'valid']:
        split_name = 'val' if split == 'valid' else split
        
        images_dir = dataset_dir / split / 'images'
        labels_dir = dataset_dir / split / 'labels'
        
        if images_dir.exists():
            for img_file in images_dir.glob('*'):
                if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                    # Copy image
                    dest_img = f'./walls_floors_dataset/{split_name}/images/{img_file.name}'
                    shutil.copy2(img_file, dest_img)
                    total_count += 1
                    
                    # Copy corresponding label
                    label_file = labels_dir / f"{img_file.stem}.txt"
                    if label_file.exists():
                        dest_label = f'./walls_floors_dataset/{split_name}/labels/{img_file.stem}.txt'
                        shutil.copy2(label_file, dest_label)
    
    print(f"✅ Prepared {total_count} images for walls/floors training")
    return total_count > 0

dataset_ready = prepare_walls_floors_dataset()

# === CELL 4: Create Training Configuration ===
# Focused on just 3 essential classes
training_config = {
    'train': './walls_floors_dataset/train',
    'val': './walls_floors_dataset/val',
    'nc': 3,
    'names': ['wall', 'floor', 'ceiling']
}

with open('./walls_floors_dataset/data.yaml', 'w') as f:
    yaml.dump(training_config, f)

print("Created focused training configuration for walls/floors/ceilings")

# === CELL 5: Fast Training (2-3 hours) ===
if dataset_ready:
    print("🚀 Starting YOLO11 focused training for walls/floors...")
    
    # Use nano model for faster training
    model = YOLO("yolo11n.pt")
    
    # Optimized training parameters for speed
    results = model.train(
        data='./walls_floors_dataset/data.yaml',
        epochs=30,          # Reduced from 50
        imgsz=416,          # Smaller image size for speed
        batch=16,           # Larger batch size
        lr0=0.01,
        device=device,
        patience=8,         # Early stopping
        save=True,
        plots=True,
        name='walls_floors_focused',
        
        # Speed optimizations
        amp=True,           # Automatic Mixed Precision
        workers=8,          # More data loading workers
        cache=True,         # Cache images in RAM
        
        # Class weights (walls/floors are large, ceiling smaller)
        class_weights=[1.0, 1.0, 1.5],  # wall, floor, ceiling
        
        # Basic augmentation only
        fliplr=0.5,
        degrees=5,
        scale=0.1
    )
    
    print("✅ Focused training completed!")
    best_model_path = "runs/detect/walls_floors_focused/weights/best.pt"
    print(f"Best model saved: {best_model_path}")
    
    # Quick validation
    metrics = model.val(data='./walls_floors_dataset/data.yaml')
    print(f"mAP@0.5: {metrics.box.map50:.3f}")
else:
    print("⚠️ Dataset preparation failed - will train with minimal setup")
    print("🔄 Creating demo training to test pipeline...")
    
    # Create a minimal training setup to test the pipeline
    model = YOLO("yolo11n.pt")
    
    # Quick test training (1 epoch to verify setup)
    try:
        results = model.train(
            data='./walls_floors_dataset/data.yaml',
            epochs=1,
            imgsz=416,
            batch=1,
            device=device,
            name='walls_floors_test',
            verbose=False
        )
        print("✅ Training pipeline verified")
    except Exception as e:
        print(f"❌ Training setup error: {e}")
        print("Check dataset structure and YAML configuration")

# === CELL 6: Test and Export ===
if dataset_ready and os.path.exists("runs/detect/walls_floors_focused/weights/best.pt"):
    # Load trained model
    trained_model = YOLO("runs/detect/walls_floors_focused/weights/best.pt")
    
    # Export for deployment
    trained_model.export(format='onnx', simplify=True)
    print("Model exported to ONNX format")
    
    # Create model info
    model_info = {
        'classes': ['wall', 'floor', 'ceiling'],
        'training_date': '2025-07-19',
        'epochs': 30,
        'mAP': float(metrics.box.map50) if 'metrics' in globals() else 0.0,
        'notes': 'Focused training on walls/floors/ceilings only - fast 2-3 hour training'
    }
    
    with open('model_info.yaml', 'w') as f:
        yaml.dump(model_info, f)

# === CELL 7: Auto-Save to Google Drive + Download ===
from google.colab import drive, files
import shutil
from datetime import datetime

# Mount Google Drive
drive.mount('/content/drive')

# Create organized folder structure in Drive
drive_folder = "/content/drive/MyDrive/YOLO11_Models"
os.makedirs(drive_folder, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
model_folder = f"{drive_folder}/walls_floors_model_{timestamp}"
os.makedirs(model_folder, exist_ok=True)

try:
    # Save to Google Drive automatically
    if os.path.exists("runs/detect/walls_floors_focused/weights/best.pt"):
        # Copy model files to Drive
        shutil.copy2("runs/detect/walls_floors_focused/weights/best.pt", 
                    f"{model_folder}/walls_floors_best.pt")
        print(f"✅ Saved best.pt to Google Drive: {model_folder}")
        
        # Also save ONNX if available
        if os.path.exists("runs/detect/walls_floors_focused/weights/best.onnx"):
            shutil.copy2("runs/detect/walls_floors_focused/weights/best.onnx", 
                        f"{model_folder}/walls_floors_best.onnx")
            print("✅ Saved ONNX to Google Drive")
        
        # Save model info
        if os.path.exists("model_info.yaml"):
            shutil.copy2("model_info.yaml", f"{model_folder}/model_info.yaml")
            print("✅ Saved model info to Google Drive")
        
        # Save training results
        if os.path.exists("runs/detect/walls_floors_focused"):
            shutil.copytree("runs/detect/walls_floors_focused", 
                          f"{model_folder}/training_results", dirs_exist_ok=True)
            print("✅ Saved training results to Google Drive")
        
        # Create deployment instructions
        instructions = f"""# YOLO11 Walls/Floors Model - {timestamp}

## Model Files
- walls_floors_best.pt: Main PyTorch model
- walls_floors_best.onnx: ONNX export for deployment
- model_info.yaml: Model specifications

## Deployment
1. Download walls_floors_best.pt from this folder
2. Upload to your API server (Colab/FastAPI)
3. Update detection endpoint to use this model

## Performance
- Classes: wall, floor, ceiling
- Training Time: ~{3} hours (vs 20 for full dataset)
- mAP@0.5: {metrics.box.map50 if 'metrics' in globals() else 'TBD'}

## Next Steps
Use this model as base for Phase 2 (furniture) training:
```python
model = YOLO('walls_floors_best.pt')
model.train(data='furniture_extended.yaml', epochs=40)
```
"""
        with open(f"{model_folder}/README.md", 'w') as f:
            f.write(instructions)
        
        print(f"\n🎯 Model automatically saved to Google Drive!")
        print(f"📁 Location: {model_folder}")
        print("✅ Ready for Phase 2 training or immediate deployment")
        
        # Also download locally for immediate access
        files.download("runs/detect/walls_floors_focused/weights/best.pt")
        print("✅ Also downloaded locally")
        
    else:
        print("❌ No trained model found to save")
        
except Exception as e:
    print(f"Google Drive save failed: {e}")
    print("Attempting local download only...")
    
    # Fallback to local download
    try:
        if os.path.exists("runs/detect/walls_floors_focused/weights/best.pt"):
            files.download("runs/detect/walls_floors_focused/weights/best.pt")
            print("✅ Downloaded locally")
    except Exception as e2:
        print(f"Local download also failed: {e2}")

# === CELL 8: Incremental Training Setup ===
print("\n📈 INCREMENTAL TRAINING READY")
print("To add more objects later, use this trained model as base:")
print("model = YOLO('best.pt')  # Load your walls/floors model")
print("model.train(data='extended_dataset.yaml', epochs=50)  # Add furniture classes")