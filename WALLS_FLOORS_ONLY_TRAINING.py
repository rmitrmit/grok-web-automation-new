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

# === CELL 2: Download Walls/Floors Dataset Only ===
rf = roboflow.Roboflow(api_key="gcscP35McEJicDDGOe5p")

downloaded_paths = []

# Only download the walls/floors dataset
try:
    project = rf.workspace("label-for-yolov8obb").project("detecting-floor-wall-and-ceiling-with-yolo-obb")
    dataset = project.version(1).download("yolov8")
    downloaded_paths.append(dataset.location)
    print(f"Downloaded walls/floors to {dataset.location}")
except Exception as e:
    print(f"Failed to download walls/floors: {e}")

print(f"Successfully downloaded {len(downloaded_paths)} dataset")

# === CELL 3: Prepare Dataset Structure ===
def prepare_combined_dataset():
    os.makedirs('./combined_dataset/train/images', exist_ok=True)
    os.makedirs('./combined_dataset/train/labels', exist_ok=True)
    os.makedirs('./combined_dataset/val/images', exist_ok=True)
    os.makedirs('./combined_dataset/val/labels', exist_ok=True)
    
    combined_count = 0
    
    for dataset_path in downloaded_paths:
        dataset_dir = Path(dataset_path)
        print(f"Processing dataset: {dataset_dir}")
        
        for split in ['train', 'valid']:
            split_name = 'val' if split == 'valid' else split
            
            images_dir = dataset_dir / split / 'images'
            labels_dir = dataset_dir / split / 'labels'
            
            if images_dir.exists():
                for img_file in images_dir.glob('*'):
                    if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                        dest_img = f'./combined_dataset/{split_name}/images/{dataset_dir.name}_{img_file.name}'
                        shutil.copy2(img_file, dest_img)
                        combined_count += 1
                        
                        label_file = labels_dir / f"{img_file.stem}.txt"
                        if label_file.exists():
                            dest_label = f'./combined_dataset/{split_name}/labels/{dataset_dir.name}_{img_file.stem}.txt'
                            shutil.copy2(label_file, dest_label)
    
    print(f"Combined {combined_count} images into training dataset")
    return combined_count > 0

dataset_ready = prepare_combined_dataset()

# === CELL 4: Create Training Configuration ===
training_config = {
    'train': './combined_dataset/train',
    'val': './combined_dataset/val',
    'nc': 3,
    'names': ['wall', 'floor', 'ceiling']
}

with open('./combined_dataset/data.yaml', 'w') as f:
    yaml.dump(training_config, f)

print("Created training configuration")

# === CELL 5: Start Training ===
if dataset_ready:
    print("Starting YOLO11 training...")
    
    model = YOLO("yolo11n.pt")
    
    results = model.train(
        data='./combined_dataset/data.yaml',
        epochs=50,
        imgsz=640,
        batch=8,
        lr0=0.01,
        device=device,
        patience=10,
        save=True,
        plots=True,
        name='interior_walls_floors'
    )
    
    print("Training completed!")
    best_model_path = "runs/detect/interior_walls_floors/weights/best.pt"
    print(f"Best model: {best_model_path}")
else:
    print("No dataset ready for training")

# === CELL 6: Test Model ===
if dataset_ready and os.path.exists("runs/detect/interior_walls_floors/weights/best.pt"):
    test_model = YOLO("runs/detect/interior_walls_floors/weights/best.pt")
    
    metrics = test_model.val(data='./combined_dataset/data.yaml')
    print(f"mAP@0.5: {metrics.box.map50:.3f}")
    
    test_model.export(format='onnx')
    print("Model exported to ONNX format")

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
    if os.path.exists("runs/detect/interior_walls_floors/weights/best.pt"):
        # Copy model files to Drive
        shutil.copy2("runs/detect/interior_walls_floors/weights/best.pt", 
                    f"{model_folder}/walls_floors_best.pt")
        print(f"Saved best.pt to Google Drive: {model_folder}")
        
        # Also save ONNX if available
        if os.path.exists("runs/detect/interior_walls_floors/weights/best.onnx"):
            shutil.copy2("runs/detect/interior_walls_floors/weights/best.onnx", 
                        f"{model_folder}/walls_floors_best.onnx")
            print("Saved ONNX to Google Drive")
        
        # Save training results
        if os.path.exists("runs/detect/interior_walls_floors"):
            shutil.copytree("runs/detect/interior_walls_floors", 
                          f"{model_folder}/training_results", dirs_exist_ok=True)
            print("Saved training results to Google Drive")
        
        # Create deployment instructions
        instructions = f"""# YOLO11 Walls/Floors Model - {timestamp}

## Model Files
- walls_floors_best.pt: Main PyTorch model
- walls_floors_best.onnx: ONNX export for deployment

## Deployment
1. Download walls_floors_best.pt from this folder
2. Upload to your API server (Colab/FastAPI)
3. Update detection endpoint to use this model

## Performance
- Classes: wall, floor, ceiling
- Training Time: ~2-3 hours 
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
        
        print(f"Model automatically saved to Google Drive!")
        print(f"Location: {model_folder}")
        print("Ready for Phase 2 training or immediate deployment")
        
        # Also download locally for immediate access
        files.download("runs/detect/interior_walls_floors/weights/best.pt")
        print("Also downloaded locally")
        
    else:
        print("No trained model found to save")
        
except Exception as e:
    print(f"Google Drive save failed: {e}")
    print("Attempting local download only...")
    
    # Fallback to local download
    try:
        if os.path.exists("runs/detect/interior_walls_floors/weights/best.pt"):
            files.download("runs/detect/interior_walls_floors/weights/best.pt")
            print("Downloaded locally")
    except Exception as e2:
        print(f"Local download also failed: {e2}")