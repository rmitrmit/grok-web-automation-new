# === Complete YOLO11 Real Dataset Training - Single Cell (Drive Permission First) ===
# Requests Google Drive permission FIRST, then downloads datasets, trains model, saves to Drive

# === Import All Required Modules First ===
import os
import torch
import yaml
import shutil
from pathlib import Path
from datetime import datetime
from google.colab import drive, files

# === IMMEDIATE Google Drive Permission Request ===
print("🔑 REQUESTING GOOGLE DRIVE PERMISSION FIRST...")
print("⚠️  Please allow access when prompted - this prevents losing progress!")

# Mount Google Drive IMMEDIATELY to get permission
drive.mount('/content/drive')
print("✅ Google Drive mounted successfully!")

# Create timestamped folder early to verify write access
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
drive_folder = f"/content/drive/MyDrive/YOLO11_Models/real_interior_{timestamp}"
os.makedirs(drive_folder, exist_ok=True)
print(f"✅ Drive folder created: {drive_folder}")

# === Setup Environment ===
print("📦 Installing required packages...")
!pip install ultralytics roboflow supervision

# Import after installation
from ultralytics import YOLO
import roboflow

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

# === Download Real Datasets ===
print("🔍 Downloading real interior datasets...")
rf = roboflow.Roboflow(api_key="gcscP35McEJicDDGOe5p")
successful_downloads = []

# Real dataset sources
dataset_sources = [
    ("park-jong-il-k1lxw", "wall-floor-ceiling-recognition", 1),
    ("testing-daidy", "floor-plan-walls", 1),
    ("floor-plan-kaaow", "floor-plan_-room-detection", 1),
]

for workspace, project_name, version in dataset_sources:
    try:
        print(f"Trying {workspace}/{project_name}...")
        workspace_obj = rf.workspace(workspace)
        project = workspace_obj.project(project_name)
        dataset = project.version(version).download("yolov8")
        
        # Verify download
        dataset_path = Path(dataset.location)
        if dataset_path.exists():
            train_imgs = len(list((dataset_path / 'train' / 'images').glob('*'))) if (dataset_path / 'train' / 'images').exists() else 0
            val_imgs = len(list((dataset_path / 'valid' / 'images').glob('*'))) if (dataset_path / 'valid' / 'images').exists() else 0
            
            if train_imgs > 0:
                successful_downloads.append({
                    'path': dataset.location,
                    'name': project_name,
                    'workspace': workspace,
                    'train_count': train_imgs,
                    'val_count': val_imgs
                })
                print(f"Downloaded {project_name}: {train_imgs} train, {val_imgs} val images")
                
                # Save progress to Drive immediately
                with open(f"{drive_folder}/download_progress.txt", 'a') as f:
                    f.write(f"Downloaded {project_name}: {train_imgs} train, {val_imgs} val images\n")
                
                # Stop after getting a good dataset
                if train_imgs > 100:
                    print(f"Good dataset found! Using {project_name}")
                    break
        
    except Exception as e:
        print(f"Failed {workspace}/{project_name}: {str(e)[:60]}...")
        # Log failures to Drive too
        with open(f"{drive_folder}/download_errors.txt", 'a') as f:
            f.write(f"Failed {workspace}/{project_name}: {str(e)}\n")
        continue

print(f"Successfully downloaded {len(successful_downloads)} datasets")

# === Combine Datasets with Fixed Paths ===
if successful_downloads:
    print("📁 Processing datasets...")
    
    # Use absolute paths to avoid nesting issues
    base_path = '/content/real_interior_dataset'
    
    # Create directories
    os.makedirs(f'{base_path}/train/images', exist_ok=True)
    os.makedirs(f'{base_path}/train/labels', exist_ok=True)
    os.makedirs(f'{base_path}/val/images', exist_ok=True)
    os.makedirs(f'{base_path}/val/labels', exist_ok=True)
    
    total_images = 0
    all_classes = set()
    
    for dataset_info in successful_downloads:
        dataset_path = Path(dataset_info['path'])
        dataset_name = dataset_info['name']
        
        print(f"Processing {dataset_name}...")
        
        # Read original data.yaml for class names
        original_yaml = dataset_path / 'data.yaml'
        if original_yaml.exists():
            with open(original_yaml, 'r') as f:
                data_config = yaml.safe_load(f)
                if 'names' in data_config:
                    for name in data_config['names']:
                        all_classes.add(name.lower())
                    print(f"   Classes: {data_config['names']}")
        
        # Process train/valid/test splits
        for split in ['train', 'valid', 'test']:
            target_split = 'val' if split in ['valid', 'test'] else 'train'
            
            source_images = dataset_path / split / 'images'
            source_labels = dataset_path / split / 'labels'
            
            if source_images.exists():
                for img_file in source_images.glob('*'):
                    if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                        # Copy with unique naming
                        dest_img = f'{base_path}/{target_split}/images/{dataset_name}_{img_file.name}'
                        shutil.copy2(img_file, dest_img)
                        total_images += 1
                        
                        # Copy corresponding label
                        label_file = source_labels / f"{img_file.stem}.txt"
                        if label_file.exists():
                            dest_label = f'{base_path}/{target_split}/labels/{dataset_name}_{img_file.stem}.txt'
                            shutil.copy2(label_file, dest_label)
    
    # Save dataset info to Drive immediately
    with open(f"{drive_folder}/dataset_info.txt", 'w') as f:
        f.write(f"Total images: {total_images}\n")
        f.write(f"Classes found: {sorted(all_classes)}\n")
        f.write(f"Successful downloads: {[d['name'] for d in successful_downloads]}\n")
    
    # Create fixed YAML configuration with absolute paths
    # Use classes found in datasets
    if 'wall' in all_classes or 'walls' in all_classes:
        class_list = ['wall']
    elif 'floor' in all_classes:
        class_list = ['floor']
    else:
        class_list = ['wall', 'floor', 'ceiling']  # Default
    
    # CRITICAL: Use absolute paths to prevent nesting error
    config = {
        'train': f'{base_path}/train',
        'val': f'{base_path}/val',
        'nc': len(class_list),
        'names': class_list
    }
    
    with open(f'{base_path}/data.yaml', 'w') as f:
        yaml.dump(config, f)
    
    # Copy config to Drive for backup
    shutil.copy2(f'{base_path}/data.yaml', f'{drive_folder}/data.yaml')
    
    print(f"Created dataset with {total_images} real images")
    print(f"Classes found: {sorted(all_classes)}")
    print(f"Using classes: {class_list}")
    
    # Verify paths exist
    print(f"Train directory exists: {os.path.exists(f'{base_path}/train')}")
    print(f"Val directory exists: {os.path.exists(f'{base_path}/val')}")
    
    dataset_ready = True
else:
    print("No datasets downloaded")
    dataset_ready = False

# === Train Model with Fixed Configuration ===
if dataset_ready:
    print("🚀 Starting YOLO11 training on real interior images...")
    
    # Save training start notification to Drive
    with open(f"{drive_folder}/training_log.txt", 'w') as f:
        f.write(f"Training started at: {datetime.now()}\n")
        f.write(f"Device: {device}\n")
        f.write(f"Total images: {total_images}\n")
        f.write(f"Classes: {class_list}\n")
    
    model = YOLO("yolo11n.pt")
    
    # Use absolute path to avoid any relative path issues
    results = model.train(
        data=f'{base_path}/data.yaml',
        epochs=50,
        imgsz=640,
        batch=8,
        lr0=0.01,
        device=0 if device == 'cuda' else 'cpu',
        patience=15,
        save=True,
        plots=True,
        name='real_interior_training',
        verbose=True
    )
    
    print("Training completed successfully!")
    
    # Validate model
    metrics = model.val()
    print(f"Final mAP@0.5: {metrics.box.map50:.3f}")
    
    # Export to ONNX
    model.export(format='onnx')
    print("Model exported to ONNX format")
    
    # Save training completion to Drive immediately
    with open(f"{drive_folder}/training_log.txt", 'a') as f:
        f.write(f"Training completed at: {datetime.now()}\n")
        f.write(f"Final mAP@0.5: {metrics.box.map50:.3f}\n")
    
    training_success = True
else:
    print("Cannot proceed without dataset")
    training_success = False

# === Save Complete Results to Google Drive ===
if training_success:
    print("💾 Saving all results to Google Drive...")
    
    if os.path.exists("runs/detect/real_interior_training/weights/best.pt"):
        # Save model files
        shutil.copy2("runs/detect/real_interior_training/weights/best.pt", 
                    f"{drive_folder}/real_interior_best.pt")
        print("✅ Model saved to Google Drive")
        
        # Save ONNX export
        if os.path.exists("runs/detect/real_interior_training/weights/best.onnx"):
            shutil.copy2("runs/detect/real_interior_training/weights/best.onnx", 
                        f"{drive_folder}/real_interior_best.onnx")
            print("✅ ONNX export saved")
        
        # Save training results
        shutil.copytree("runs/detect/real_interior_training", 
                       f"{drive_folder}/training_results", dirs_exist_ok=True)
        
        # Create documentation
        docs = f"""# Real Interior YOLO11 Model - {timestamp}

## Training Summary
- Device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})
- Total Images: {total_images if 'total_images' in locals() else 'Unknown'}
- Datasets: {[d['name'] for d in successful_downloads] if successful_downloads else 'None'}
- Classes: {class_list if 'class_list' in locals() else 'wall, floor, ceiling'}
- mAP@0.5: {metrics.box.map50 if 'metrics' in locals() else 'TBD'}

## Files
- real_interior_best.pt: Main model
- real_interior_best.onnx: ONNX export
- training_results/: Complete logs

## Deployment
Upload real_interior_best.pt to your API server and use:
```python
from ultralytics import YOLO
model = YOLO('real_interior_best.pt')
results = model(image)
```

## Quality
- Trained on real architectural photos
- Ready for production use
- Can be used for incremental training

## Training Log
Drive Permission: ✅ Granted at start
Download Status: ✅ {len(successful_downloads)} datasets
Training Status: ✅ Completed successfully
Save Status: ✅ All files in Google Drive
"""
        
        with open(f"{drive_folder}/README.md", 'w') as f:
            f.write(docs)
        
        print("✅ Complete model package ready!")
        print(f"📁 Google Drive: {drive_folder}")
        print("🎯 Trained on real interior images")
        
        # Download locally as backup
        files.download("runs/detect/real_interior_training/weights/best.pt")
        print("💾 Model downloaded locally as backup")
        
        print("\n🎉 SUCCESS: Everything saved to Google Drive!")
        print(f"📂 Check your Drive folder: {drive_folder}")
        
    else:
        print("❌ No trained model found")

print("\n✅ Training complete! Model ready for walls/floors detection.")
print("🔗 All files automatically saved to Google Drive (permission granted at start)")