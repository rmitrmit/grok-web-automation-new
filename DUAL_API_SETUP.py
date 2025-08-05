# Dual YOLO API Setup - Run General + Custom Walls/Floors Models
# This creates a specialized walls/floors API while keeping your existing general API

# Install requirements
!pip install ultralytics fastapi uvicorn python-multipart pyngrok

# Import libraries
from ultralytics import YOLO
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import threading
import time
from pyngrok import ngrok
import json
import requests

# Create specialized Walls/Floors API
app = FastAPI(title="YOLO11 Walls/Floors Specialist API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global custom model
walls_floors_model = None

def load_custom_model():
    global walls_floors_model
    print("Loading custom walls/floors model...")
    
    if os.path.exists('real_interior_best.pt'):
        walls_floors_model = YOLO('real_interior_best.pt')
        print("✅ Custom walls/floors model loaded!")
        return True
    else:
        print("⚠️ real_interior_best.pt not found")
        return False

@app.on_event("startup")
async def startup_event():
    load_custom_model()

@app.get("/")
async def root():
    return {
        "message": "YOLO11 Walls/Floors Specialist API",
        "status": "running",
        "specializes_in": ["walls", "floors", "ceilings", "architectural_elements"],
        "model": "real_interior_best.pt (custom trained)" if walls_floors_model else "not loaded"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "model_loaded": walls_floors_model is not None,
        "api_type": "walls_floors_specialist"
    }

@app.post("/detect")
async def detect_walls_floors(
    file: UploadFile = File(...),
    confidence: float = Form(0.25),  # Lower threshold for architectural elements
    drawing_path: str = Form(None)
):
    """Specialized detection for walls, floors, and architectural elements"""
    
    if not walls_floors_model:
        return JSONResponse(
            {"error": "Custom walls/floors model not loaded"}, 
            status_code=503
        )
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        print("Running walls/floors specialized detection...")
        
        # Run detection with custom model
        results = walls_floors_model(tmp_file_path, conf=confidence)
        
        # Process results - focus on architectural elements
        architectural_objects = []
        for r in results:
            if r.boxes is not None:
                for i, box in enumerate(r.boxes):
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    cls = int(box.cls[0])
                    name = walls_floors_model.names[cls]
                    
                    # Filter for architectural elements
                    if name.lower() in ['wall', 'floor', 'ceiling', 'door', 'window']:
                        obj = {
                            "name": name,
                            "confidence": conf,
                            "x": float(xyxy[0]),
                            "y": float(xyxy[1]),
                            "width": float(xyxy[2] - xyxy[0]),
                            "height": float(xyxy[3] - xyxy[1]),
                            "class_id": cls,
                            "api_source": "walls_floors_specialist"
                        }
                        
                        # Add segmentation if available
                        if hasattr(r, 'masks') and r.masks is not None and len(r.masks.xy) > i:
                            mask = r.masks.xy[i]
                            if len(mask) > 0:
                                points = mask.flatten().tolist()
                                obj["segmentation"] = points
                                obj["canSegment"] = True
                        else:
                            obj["canSegment"] = False
                        
                        architectural_objects.append(obj)
        
        return JSONResponse({
            "objects": architectural_objects,
            "model_used": "walls_floors_specialist",
            "total_detections": len(architectural_objects),
            "specializes_in": "architectural_elements"
        })
        
    except Exception as e:
        print(f"Detection error: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)
        
    finally:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)

@app.post("/upload_model")
async def upload_custom_model(model: UploadFile = File(...)):
    """Upload the trained walls/floors model"""
    if not model.filename.endswith('.pt'):
        return JSONResponse({"error": "Only .pt model files allowed"}, status_code=400)
    
    try:
        # Save uploaded model
        with open("real_interior_best.pt", "wb") as f:
            content = await model.read()
            f.write(content)
        
        # Reload the model
        global walls_floors_model
        walls_floors_model = YOLO('real_interior_best.pt')
        
        return JSONResponse({
            "message": "Walls/floors model uploaded and loaded successfully",
            "filename": model.filename,
            "size": len(content),
            "specialization": "walls_floors_detection"
        })
        
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/models")
async def model_info():
    """Get information about the specialized model"""
    if walls_floors_model:
        return JSONResponse({
            "model": {
                "name": "real_interior_best.pt",
                "type": "walls_floors_specialist", 
                "loaded": True,
                "classes": list(walls_floors_model.names.values()),
                "specializes_in": ["wall", "floor", "ceiling", "door", "window"]
            }
        })
    else:
        return JSONResponse({"model": {"loaded": False}})

# Start server function
def start_walls_floors_server():
    """Start the specialized walls/floors API server"""
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")  # Different port

# Main execution
if __name__ == "__main__":
    print("🏠 Starting Walls/Floors Specialist API...")
    
    # Start server in background thread
    server_thread = threading.Thread(target=start_walls_floors_server, daemon=True)
    server_thread.start()
    
    # Wait for server to start
    time.sleep(5)
    
    # Start ngrok tunnel on port 8001
    print("🌐 Starting ngrok tunnel for walls/floors API...")
    walls_floors_url = ngrok.connect(8001)
    
    print("\n" + "="*60)
    print("✅ Dual YOLO API Setup Complete!")
    print(f"🏠 Walls/Floors API: {walls_floors_url}")
    print(f"🔧 General YOLO API: (keep your existing one running)")
    print("="*60)
    print("📋 URLs to update in your frontend:")
    print(f"   - Walls/Floors: {walls_floors_url}")
    print(f"   - General: (your existing ngrok URL)")
    print("="*60)
    
    # Keep the server running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping walls/floors server...")
        ngrok.kill()