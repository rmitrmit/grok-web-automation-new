# Complete YOLO API Server Setup - Single Cell
# Run this in Google Colab to create a working YOLO server with your custom model

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

# Create FastAPI app
app = FastAPI(title="YOLO11 Detection API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global models
base_model = None
custom_model = None

def load_models():
    global base_model, custom_model
    print("Loading base model...")
    base_model = YOLO('yolo11n.pt')  # This will download automatically
    
    # Check for custom model
    if os.path.exists('real_interior_best.pt'):
        print("Loading custom walls/floors model...")
        custom_model = YOLO('real_interior_best.pt')
        print("✅ Custom model loaded successfully!")
    else:
        print("⚠️ Custom model not found - will use base model only")

@app.on_event("startup")
async def startup_event():
    load_models()

@app.get("/")
async def root():
    return {
        "message": "YOLO11 Instance Segmentation API",
        "status": "running",
        "models": {
            "base": "yolo11n.pt (loaded)" if base_model else "not loaded",
            "custom": "real_interior_best.pt (loaded)" if custom_model else "not available"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "models_loaded": base_model is not None}

@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...),
    use_custom_model: bool = Form(False),
    model_version: str = Form("base"),
    confidence: float = Form(0.3),
    drawing_path: str = Form(None)
):
    """Detect objects in uploaded image"""
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        # Choose model
        if use_custom_model and model_version == "walls_floors" and custom_model:
            model = custom_model
            model_name = "walls_floors (custom)"
        else:
            model = base_model
            model_name = "base (yolo11n)"
        
        print(f"Using model: {model_name}")
        
        # Run detection
        results = model(tmp_file_path, conf=confidence)
        
        # Process results
        objects = []
        for r in results:
            if r.boxes is not None:
                for i, box in enumerate(r.boxes):
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    cls = int(box.cls[0])
                    name = model.names[cls]
                    
                    obj = {
                        "name": name,
                        "confidence": conf,
                        "x": float(xyxy[0]),
                        "y": float(xyxy[1]),
                        "width": float(xyxy[2] - xyxy[0]),
                        "height": float(xyxy[3] - xyxy[1]),
                        "class_id": cls
                    }
                    
                    # Add segmentation if available
                    if hasattr(r, 'masks') and r.masks is not None:
                        # Convert mask to polygon points
                        mask = r.masks.xy[i]
                        if len(mask) > 0:
                            points = mask.flatten().tolist()
                            obj["segmentation"] = points
                            obj["canSegment"] = True
                    else:
                        obj["canSegment"] = False
                    
                    objects.append(obj)
        
        return JSONResponse({
            "objects": objects,
            "model_used": model_name,
            "total_detections": len(objects)
        })
        
    except Exception as e:
        print(f"Detection error: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)
        
    finally:
        # Clean up temp file
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)

@app.post("/upload_model")
async def upload_model(model: UploadFile = File(...)):
    """Upload custom trained model"""
    if not model.filename.endswith('.pt'):
        return JSONResponse({"error": "Only .pt model files allowed"}, status_code=400)
    
    try:
        # Save uploaded model
        with open("real_interior_best.pt", "wb") as f:
            content = await model.read()
            f.write(content)
        
        # Reload models
        global custom_model
        custom_model = YOLO('real_interior_best.pt')
        
        return JSONResponse({
            "message": "Model uploaded and loaded successfully",
            "filename": model.filename,
            "size": len(content)
        })
        
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/models")
async def list_models():
    """List available models"""
    models = {
        "base": {
            "name": "yolo11n.pt",
            "loaded": base_model is not None,
            "classes": list(base_model.names.values()) if base_model else []
        }
    }
    
    if custom_model:
        models["custom"] = {
            "name": "real_interior_best.pt", 
            "loaded": True,
            "classes": list(custom_model.names.values())
        }
    
    return JSONResponse(models)

# Start server function
def start_server():
    """Start the FastAPI server"""
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

# Main execution
if __name__ == "__main__":
    print("🚀 Starting YOLO11 API Server...")
    
    # Start server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Wait for server to start
    time.sleep(5)
    
    # Kill any existing ngrok tunnels
    ngrok.kill()
    
    # Start ngrok tunnel
    print("🌐 Starting ngrok tunnel...")
    public_url = ngrok.connect(8000)
    
    print("\n" + "="*50)
    print("✅ YOLO API Server Ready!")
    print(f"🌍 Public URL: {public_url}")
    print(f"📋 Copy this URL to update your frontend: {public_url}")
    print("="*50)
    
    # Keep the server running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping server...")
        ngrok.kill()