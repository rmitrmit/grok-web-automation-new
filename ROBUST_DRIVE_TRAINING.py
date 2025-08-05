# === Complete YOLO11 Real Dataset Training - Robust Drive Mount ===
# Handles common Google Drive mounting issues and provides fallbacks

# === Import All Required Modules First ===
import os
import torch
import yaml
import shutil
import time
from pathlib import Path
from datetime import datetime

print("🔑 REQUESTING GOOGLE DRIVE PERMISSION...")
print("⚠️  Please allow access when prompted - this prevents losing progress!")

# === Robust Google Drive Mount with Retry Logic ===
def mount_drive_with_retry(max_attempts=3):
    """Attempt to mount Google Drive with retry logic"""
    from google.colab import drive
    
    for attempt in range(max_attempts):
        try:
            print(f"Attempt {attempt + 1}/{max_attempts} to mount Google Drive...")
            
            # Try different mount options
            if attempt == 0:
                # Standard mount
                drive.mount('/content/drive')
            elif attempt == 1:
                # Force remount
                drive.mount('/content/drive', force_remount=True)
            else:
                # Last attempt with timeout
                drive.mount('/content/drive', force_remount=True, timeout_ms=120000)
            
            # Test if mount was successful
            if os.path.exists('/content/drive/MyDrive'):
                print("✅ Google Drive mounted successfully!")
                return True
            else:
                print(f"❌ Mount attempt {attempt + 1} failed - directory not accessible")
                time.sleep(5)
                
        except Exception as e:
            print(f"❌ Mount attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_attempts - 1:
                print("🔄 Retrying in 10 seconds...")
                time.sleep(10)
            else:
                print("⚠️  All mount attempts failed. Training will continue without Drive backup.")
                return False
    
    return False

# === Alternative: Use Local Storage if Drive Fails ===
def setup_storage(use_drive=True):
    """Setup storage location with Drive fallback"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if use_drive:
        drive_mounted = mount_drive_with_retry()
        
        if drive_mounted:
            try:
                drive_folder = f"/content/drive/MyDrive/YOLO11_Models/real_interior_{timestamp}"
                os.makedirs(drive_folder, exist_ok=True)
                print(f"✅ Drive folder created: {drive_folder}")
                return drive_folder, True
            except Exception as e:
                print(f"❌ Failed to create Drive folder: {e}")
                print("🔄 Falling back to local storage...")
    
    # Fallback to local storage
    local_folder = f"/content/yolo11_models/real_interior_{timestamp}"
    os.makedirs(local_folder, exist_ok=True)
    print(f"📁 Using local storage: {local_folder}")
    print("⚠️  Remember to download results manually!")
    return local_folder, False

# Setup storage
storage_folder, using_drive = setup_storage(use_drive=True)

# === Setup Environment ===
print("📦 Installing required packages...")
!pip install ultralytics roboflow supervision

# Import after installation
from ultralytics import YOLO
import roboflow
from google.colab import files

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

# === Progress Logging Function ===
def log_progress(message, save_to_storage=True):
    """Log progress both to console and storage"""
    print(message)
    if save_to_storage:
        try:
            with open(f"{storage_folder}/training_progress.log", 'a') as f:
                f.write(f"{datetime.now()}: {message}\n")
        except Exception as e:
            print(f"Warning: Could not save to log: {e}")

log_progress("🚀 Training started", True)

# === Download Real Datasets ===
log_progress("🔍 Downloading real interior datasets...")
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
        log_progress(f"Trying {workspace}/{project_name}...")
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
                log_progress(f"Downloaded {project_name}: {train_imgs} train, {val_imgs} val images")
                
                # Stop after getting a good dataset
                if train_imgs > 100:
                    log_progress(f"Good dataset found! Using {project_name}")
                    break
        
    except Exception as e:
        log_progress(f"Failed {workspace}/{project_name}: {str(e)[:60]}...")
        continue

log_progress(f"Successfully downloaded {len(successful_downloads)} datasets")

# === Combine Datasets with Fixed Paths ===
if successful_downloads:
    log_progress("📁 Processing datasets...")
    
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
        
        log_progress(f"Processing {dataset_name}...")
        
        # Read original data.yaml for class names
        original_yaml = dataset_path / 'data.yaml'
        if original_yaml.exists():
            with open(original_yaml, 'r') as f:
                data_config = yaml.safe_load(f)
                if 'names' in data_config:
                    for name in data_config['names']:
                        all_classes.add(name.lower())
                    log_progress(f"   Classes: {data_config['names']}")
        
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
    
    # Copy config to storage for backup
    try:
        shutil.copy2(f'{base_path}/data.yaml', f'{storage_folder}/data.yaml')
    except:
        pass
    
    log_progress(f"Created dataset with {total_images} real images")
    log_progress(f"Classes found: {sorted(all_classes)}")
    log_progress(f"Using classes: {class_list}")
    
    dataset_ready = True
else:
    log_progress("No datasets downloaded")
    dataset_ready = False

# === Train Model with Fixed Configuration ===
if dataset_ready:
    log_progress("🚀 Starting YOLO11 training on real interior images...")
    
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
    
    log_progress("Training completed successfully!")
    
    # Validate model
    metrics = model.val()
    log_progress(f"Final mAP@0.5: {metrics.box.map50:.3f}")
    
    # Export to ONNX
    model.export(format='onnx')
    log_progress("Model exported to ONNX format")
    
    training_success = True
else:
    log_progress("Cannot proceed without dataset")
    training_success = False

# === Save Complete Results ===
if training_success:
    log_progress("💾 Saving all results...")
    
    if os.path.exists("runs/detect/real_interior_training/weights/best.pt"):
        # Save model files
        try:
            shutil.copy2("runs/detect/real_interior_training/weights/best.pt", 
                        f"{storage_folder}/real_interior_best.pt")
            log_progress(f"✅ Model saved to {storage_folder}")
            
            # Save ONNX export
            if os.path.exists("runs/detect/real_interior_training/weights/best.onnx"):
                shutil.copy2("runs/detect/real_interior_training/weights/best.onnx", 
                            f"{storage_folder}/real_interior_best.onnx")
                log_progress("✅ ONNX export saved")
            
            # Save training results
            shutil.copytree("runs/detect/real_interior_training", 
                           f"{storage_folder}/training_results", dirs_exist_ok=True)
            
            # Create documentation
            docs = f"""# Real Interior YOLO11 Model - {datetime.now().strftime("%Y%m%d_%H%M%S")}

## Training Summary
- Device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})
- Total Images: {total_images if 'total_images' in locals() else 'Unknown'}
- Datasets: {[d['name'] for d in successful_downloads] if successful_downloads else 'None'}
- Classes: {class_list if 'class_list' in locals() else 'wall, floor, ceiling'}
- mAP@0.5: {metrics.box.map50 if 'metrics' in locals() else 'TBD'}
- Storage: {'Google Drive' if using_drive else 'Local (manual download needed)'}

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
"""
            
            with open(f"{storage_folder}/README.md", 'w') as f:
                f.write(docs)
            
            log_progress("✅ Complete model package ready!")
            log_progress(f"📁 Location: {storage_folder}")
            log_progress("🎯 Trained on real interior images")
            
            # Download locally as backup
            files.download("runs/detect/real_interior_training/weights/best.pt")
            log_progress("💾 Model downloaded locally as backup")
            
            if using_drive:
                log_progress("\n🎉 SUCCESS: Everything saved to Google Drive!")
            else:
                log_progress("\n⚠️  SUCCESS: Training complete but using local storage.")
                log_progress("📥 Remember to download all files from the storage folder!")
                
        except Exception as e:
            log_progress(f"❌ Error saving results: {e}")
    else:
        log_progress("❌ No trained model found")

log_progress("✅ Training script completed!")
if not using_drive:
    print("\n📥 IMPORTANT: Download your model files manually:")
    print(f"   - Location: {storage_folder}")
    print("   - Files: real_interior_best.pt, real_interior_best.onnx, README.md")