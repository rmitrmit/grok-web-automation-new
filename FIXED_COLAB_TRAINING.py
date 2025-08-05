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

# === CELL 2: Download Working Datasets ===
rf = roboflow.Roboflow(api_key="gcscP35McEJicDDGOe5p")

downloaded_paths = []

try:
    project = rf.workspace("label-for-yolov8obb").project("detecting-floor-wall-and-ceiling-with-yolo-obb")
    dataset = project.version(1).download("yolov8")
    downloaded_paths.append(dataset.location)
    print(f"Downloaded walls/floors to {dataset.location}")
except Exception as e:
    print(f"Failed to download walls/floors: {e}")

try:
    project = rf.workspace("singapore-university-of-technology-and-design").project("interior-furniture")
    dataset = project.version(1).download("yolov8")
    downloaded_paths.append(dataset.location)
    print(f"Downloaded furniture to {dataset.location}")
except Exception as e:
    print(f"Failed to download furniture: {e}")

print(f"Successfully downloaded {len(downloaded_paths)} datasets")

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

# === CELL 7: Download Results ===
from google.colab import files

if os.path.exists("runs/detect/interior_walls_floors/weights/best.pt"):
    files.download("runs/detect/interior_walls_floors/weights/best.pt")
    print("Model downloaded successfully!")

# === CELL 8: Furniture Dataset Training ===
def train_furniture_model():
    furniture_config = {
        'train': './combined_dataset/train',
        'val': './combined_dataset/val', 
        'nc': 6,
        'names': ['chair', 'table', 'sofa', 'bed', 'cabinet', 'lamp']
    }
    
    with open('./furniture_dataset/data.yaml', 'w') as f:
        yaml.dump(furniture_config, f)
    
    furniture_model = YOLO("yolo11m.pt")
    
    furniture_results = model.train(
        data='./furniture_dataset/data.yaml',
        epochs=80,
        imgsz=640,
        batch=16,
        lr0=0.01,
        class_weights=[1.2, 1.8, 1.5, 2.5, 2.0, 3.0],
        augment=True,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.15,
        device=device,
        patience=15,
        save=True,
        name='interior_furniture'
    )
    
    return furniture_model

if len(downloaded_paths) > 1:
    furniture_model = train_furniture_model()
    print("Furniture model training completed!")

# === CELL 9: Alternative Simple Training ===
def simple_coco_training():
    print("Training on COCO pretrained model with interior focus...")
    
    simple_model = YOLO("yolo11m.pt")
    
    simple_results = simple_model.train(
        data='coco.yaml',
        epochs=20,
        imgsz=640,
        batch=16,
        classes=[56, 57, 59, 60, 61, 62, 63, 64, 65, 67, 70, 72, 73, 74, 75],
        device=device,
        name='coco_interior_focused'
    )
    
    return simple_model

coco_model = simple_coco_training()
print("COCO interior-focused training completed!")

# === CELL 10: Export All Models ===
models_to_export = [
    "runs/detect/interior_walls_floors/weights/best.pt",
    "runs/detect/interior_furniture/weights/best.pt", 
    "runs/detect/coco_interior_focused/weights/best.pt"
]

for model_path in models_to_export:
    if os.path.exists(model_path):
        model = YOLO(model_path)
        model.export(format='onnx')
        files.download(model_path)
        print(f"Exported and downloaded: {model_path}")

print("All models ready for deployment!")