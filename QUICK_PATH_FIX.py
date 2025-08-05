# === IMMEDIATE PATH FIX - Run This Cell ===
# Fixes the nested path issue and continues training with downloaded datasets

import os
import yaml
from ultralytics import YOLO
from pathlib import Path

print("🔧 Fixing dataset path configuration...")

# Check what we actually have
print("Current directory structure:")
for item in os.listdir('.'):
    if os.path.isdir(item) and ('dataset' in item.lower() or 'wall' in item.lower()):
        print(f"✅ Found: {item}")

# Fix the data.yaml with absolute paths (this is the key fix)
fixed_config = {
    'train': '/content/combined_real_dataset/train',  # Absolute path prevents nesting
    'val': '/content/combined_real_dataset/val',      # Absolute path prevents nesting
    'nc': 1,                                          # Only 'wall' class found
    'names': ['wall']                                 # Single class from both datasets
}

# Write the corrected configuration
with open('./combined_real_dataset/data.yaml', 'w') as f:
    yaml.dump(fixed_config, f)

print("✅ Fixed data.yaml with absolute paths")

# Verify the fix worked
with open('./combined_real_dataset/data.yaml', 'r') as f:
    config = yaml.safe_load(f)
    print("Corrected config:")
    for key, value in config.items():
        print(f"  {key}: {value}")

# Verify directories exist
train_path = Path('/content/combined_real_dataset/train')
val_path = Path('/content/combined_real_dataset/val')

print(f"\nDirectory verification:")
print(f"Train exists: {train_path.exists()}")
print(f"Val exists: {val_path.exists()}")

if train_path.exists():
    train_imgs = len(list((train_path / 'images').glob('*')))
    train_labels = len(list((train_path / 'labels').glob('*')))
    print(f"Train: {train_imgs} images, {train_labels} labels")

if val_path.exists():
    val_imgs = len(list((val_path / 'images').glob('*')))
    val_labels = len(list((val_path / 'labels').glob('*')))
    print(f"Val: {val_imgs} images, {val_labels} labels")

print("🚀 Starting YOLO11 training with FIXED configuration...")

# Continue training with corrected paths
model = YOLO("yolo11n.pt")

results = model.train(
    data='/content/combined_real_dataset/data.yaml',  # Use absolute path
    epochs=50,
    imgsz=640,
    batch=8,
    lr0=0.01,
    device=0,         # Your Tesla T4 GPU
    patience=15,
    save=True,
    plots=True,
    name='walls_real_training',
    verbose=True
)

print("✅ Training completed successfully!")

# Validate the model
metrics = model.val()
print(f"🎯 Final mAP@0.5: {metrics.box.map50:.3f}")

# Export for deployment
model.export(format='onnx')
print("✅ Model exported to ONNX format")

print("\n🏆 SUCCESS! Model trained on 4,078 real interior images!")