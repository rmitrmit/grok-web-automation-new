# Google Colab Training Script for Interior Design YOLO11
# Focus: walls, floors, lamps, couches, tables, chairs

# === CELL 1: Setup Environment ===
!pip install ultralytics roboflow supervision
!pip install -q torch torchvision torchaudio

import os
from ultralytics import YOLO
import torch
import roboflow
import yaml

# Check GPU availability
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

# === CELL 2: Download Datasets ===
# Initialize Roboflow (you'll need to sign up for free API key)
rf = roboflow.Roboflow(api_key="YOUR_ROBOFLOW_API_KEY")

# Download priority datasets
datasets_to_download = [
    {
        'workspace': 'label-for-yolov8obb',
        'project': 'detecting-floor-wall-and-ceiling-with-yolo.obb', 
        'version': 1,
        'name': 'walls_floors'
    },
    {
        'workspace': 'furniture-detection',
        'project': 'furniture-segmentation-enhanced',
        'version': 1, 
        'name': 'furniture'
    }
]

downloaded_paths = []
for dataset_info in datasets_to_download:
    try:
        project = rf.workspace(dataset_info['workspace']).project(dataset_info['project'])
        dataset = project.version(dataset_info['version']).download("yolov8")
        downloaded_paths.append(dataset.location)
        print(f"Downloaded {dataset_info['name']} to {dataset.location}")
    except Exception as e:
        print(f"Failed to download {dataset_info['name']}: {e}")

# === CELL 3: Create Combined Dataset Configuration ===
# Your focused 6-class configuration
focused_config = {
    'train': './datasets/combined/train',
    'val': './datasets/combined/val', 
    'nc': 6,
    'names': ['wall', 'floor', 'lamp', 'couch', 'table', 'chair']
}

# Write config file
os.makedirs('./datasets/combined', exist_ok=True)
with open('./datasets/combined/data.yaml', 'w') as f:
    yaml.dump(focused_config, f)

print("Created focused dataset configuration")

# === CELL 4: Data Preparation (Manual step - you'll need to combine datasets)
print("""
MANUAL STEP REQUIRED:
1. Combine downloaded datasets into /datasets/combined/train and /datasets/combined/val
2. Ensure labels match your 6 classes: wall, floor, lamp, couch, table, chair
3. Convert any bounding box annotations to segmentation masks if needed

For now, we'll use a smaller sample dataset to test the pipeline.
""")

# === CELL 5: Training Configuration ===
class InteriorTrainingConfig:
    def __init__(self):
        self.model_size = "yolo11m.pt"  # Medium model for balance
        self.epochs = 80
        self.batch_size = 16
        self.image_size = 640
        self.learning_rate = 0.01
        
        # Class weights for imbalanced dataset
        self.class_weights = [
            2.0,  # wall (new class - high weight)
            2.0,  # floor (new class - high weight) 
            3.0,  # lamp (rare - highest weight)
            1.5,  # couch (improve segmentation)
            1.8,  # table (improve detection)
            1.2   # chair (fine-tune segmentation)
        ]
        
        self.augmentation_config = {
            'fliplr': 0.5,      # Horizontal flip
            'flipud': 0.1,      # Vertical flip  
            'mosaic': 1.0,      # Mosaic augmentation
            'mixup': 0.15,      # Mixup augmentation
            'copy_paste': 0.3,  # Copy-paste (helps segmentation)
        }

config = InteriorTrainingConfig()

# === CELL 6: Two-Stage Training ===
def train_interior_model():
    # Stage 1: Feature extraction (freeze backbone)
    print("=== STAGE 1: Feature Extraction Training ===")
    model = YOLO(config.model_size)
    
    stage1_results = model.train(
        data='./datasets/combined/data.yaml',
        epochs=20,
        imgsz=config.image_size,
        batch=config.batch_size,
        lr0=0.001,  # Lower learning rate
        freeze=[0, 1, 2, 3, 4, 5],  # Freeze backbone layers
        device=device,
        patience=10,
        save=True,
        plots=True,
        name='stage1_interior'
    )
    
    # Stage 2: Fine-tuning (unfreeze all)
    print("\n=== STAGE 2: Full Model Fine-tuning ===")
    stage2_results = model.train(
        data='./datasets/combined/data.yaml',
        epochs=config.epochs,
        imgsz=config.image_size,
        batch=config.batch_size,
        lr0=config.learning_rate,
        class_weights=config.class_weights,
        
        # Enhanced augmentation
        augment=True,
        **config.augmentation_config,
        
        device=device,
        patience=15,
        save=True,
        plots=True,
        name='stage2_interior',
        resume=True  # Resume from stage 1
    )
    
    return model, stage2_results

# Start training
if len(downloaded_paths) > 0:  # Only train if we have data
    trained_model, results = train_interior_model()
    print("Training completed!")
    
    # Best model path
    best_model_path = f"runs/detect/stage2_interior/weights/best.pt"
    print(f"Best model saved at: {best_model_path}")
else:
    print("No datasets available for training. Please check dataset downloads.")

# === CELL 7: Model Evaluation ===
def evaluate_model(model_path):
    """Evaluate the trained model"""
    model = YOLO(model_path)
    
    # Validate on test set
    metrics = model.val(data='./datasets/combined/data.yaml')
    
    print("=== Model Performance ===")
    print(f"mAP@0.5: {metrics.box.map50:.3f}")
    print(f"mAP@0.5:0.95: {metrics.box.map:.3f}")
    
    # Per-class metrics
    if hasattr(metrics.box, 'maps'):
        class_names = focused_config['names']
        for i, (class_name, ap) in enumerate(zip(class_names, metrics.box.maps)):
            print(f"{class_name}: {ap:.3f}")
    
    return metrics

# Evaluate if model exists
if 'trained_model' in locals():
    eval_metrics = evaluate_model(best_model_path)

# === CELL 8: Test Inference ===
def test_interior_detection(model_path, test_image_path):
    """Test the trained model on a sample image"""
    model = YOLO(model_path)
    
    # Run inference
    results = model(test_image_path)
    
    # Display results
    for result in results:
        # Plot image with detections
        result.plot()
        result.show()
        
        # Print detections
        if result.boxes is not None:
            print(f"Detected {len(result.boxes)} objects:")
            for box, conf, cls in zip(result.boxes.xyxy, result.boxes.conf, result.boxes.cls):
                class_name = focused_config['names'][int(cls)]
                print(f"- {class_name}: {conf:.3f}")

# Test on sample image (you'll need to upload a test image)
# test_interior_detection(best_model_path, "test_interior_room.jpg")

# === CELL 9: Export for Deployment ===
def export_model(model_path):
    """Export model for production use"""
    model = YOLO(model_path)
    
    # Export to different formats
    model.export(format='onnx')     # For web deployment
    model.export(format='torchscript')  # For PyTorch deployment
    
    print("Model exported successfully!")
    print("Files created:")
    print(f"- ONNX: {model_path.replace('.pt', '.onnx')}")
    print(f"- TorchScript: {model_path.replace('.pt', '.torchscript')}")

# Export if model exists
if 'trained_model' in locals():
    export_model(best_model_path)

# === CELL 10: Generate API Integration Code ===
api_integration_code = '''
# FastAPI Backend Integration
from ultralytics import YOLO
import cv2
import numpy as np

# Load your trained model
custom_model = YOLO("path/to/your/interior_focused_yolo11.pt")

@app.post("/detect-custom")
async def detect_with_custom_model(file: UploadFile):
    # Read uploaded image
    image_data = await file.read()
    nparr = np.frombuffer(image_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Run inference
    results = custom_model(image)
    
    # Format results
    detections = []
    for result in results:
        if result.masks is not None:  # Segmentation results
            for mask, box, conf, cls in zip(result.masks.xy, result.boxes.xyxy, result.boxes.conf, result.boxes.cls):
                detection = {
                    "name": custom_model.names[int(cls)],
                    "confidence": float(conf),
                    "x": float(box[0]),
                    "y": float(box[1]), 
                    "width": float(box[2] - box[0]),
                    "height": float(box[3] - box[1]),
                    "segmentation_mask": mask.tolist(),  # Polygon points
                    "source": "YOLO11_Custom",
                    "canSegment": True
                }
                detections.append(detection)
    
    return {"success": True, "objects": detections}
'''

print("API Integration Code:")
print(api_integration_code)

# === CELL 11: Performance Summary ===
print("""
=== TRAINING SUMMARY ===

Target Classes:
✓ wall - Architectural element detection
✓ floor - Surface identification  
✓ lamp - Lighting fixture recognition
✓ couch - Improved furniture segmentation
✓ table - Better detection accuracy
✓ chair - Enhanced edge precision

Expected Improvements:
- Wall detection: 0% → 85%+
- Floor detection: 0% → 80%+
- Lamp segmentation: 0% → 70%+
- Couch segmentation: 60% → 90%+
- Table segmentation: 0% → 80%+
- Chair segmentation: 75% → 90%+

Next Steps:
1. Download your best model weights
2. Integrate with your FastAPI backend
3. Update frontend to use custom model
4. Test on real interior design images
""")