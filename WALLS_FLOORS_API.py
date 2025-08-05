# Walls/Floors Specialist API - Run this in a NEW Google Colab notebook
# This is your second API that will use your trained real_interior_best.pt model

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

# Create the walls/floors specialist API
app = FastAPI(title="Walls/Floors Specialist API", version="1.0.0")

# Add CORS to allow your Replit app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store the custom model
walls_floors_model = None

@app.on_event("startup")
async def startup_event():
    """Load the model when server starts"""
    global walls_floors_model
    if os.path.exists('real_interior_best.pt'):
        print("Loading custom walls/floors model...")
        walls_floors_model = YOLO('real_interior_best.pt')
        print("✅ Model loaded successfully!")
    else:
        print("⚠️ Model file not found - upload it first")

@app.get("/")
async def root():
    """Main endpoint - shows API info"""
    return {
        "message": "Walls/Floors Specialist API",
        "status": "running",
        "model_loaded": walls_floors_model is not None,
        "specializes_in": ["walls", "floors", "ceilings"]
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "model_ready": walls_floors_model is not None}

@app.post("/detect")
async def detect_walls_floors(file: UploadFile = File(...)):
    """Detect walls, floors, and ceilings in uploaded image"""
    
    if not walls_floors_model:
        return JSONResponse({"error": "Model not loaded"}, status_code=503)
    
    # Save uploaded image temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        image_path = tmp_file.name
    
    try:
        # Run detection with your trained model
        results = walls_floors_model(image_path, conf=0.25)
        
        # Process results
        detected_objects = []
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    # Get detection info
                    confidence = float(box.conf[0])
                    coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                    class_id = int(box.cls[0])
                    class_name = walls_floors_model.names[class_id]
                    
                    # Only include architectural elements
                    if class_name.lower() in ['wall', 'floor', 'ceiling']:
                        detected_objects.append({
                            "name": class_name,
                            "confidence": confidence,
                            "x": coords[0],
                            "y": coords[1], 
                            "width": coords[2] - coords[0],
                            "height": coords[3] - coords[1],
                            "class_id": class_id
                        })
        
        return JSONResponse({
            "objects": detected_objects,
            "model_used": "walls_floors_specialist",
            "total_detections": len(detected_objects)
        })
        
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        # Clean up
        os.unlink(image_path)

@app.post("/upload_model")
async def upload_model(model: UploadFile = File(...)):
    """Upload your real_interior_best.pt model file"""
    
    if not model.filename.endswith('.pt'):
        return JSONResponse({"error": "Only .pt files allowed"}, status_code=400)
    
    try:
        # Save the uploaded model
        with open("real_interior_best.pt", "wb") as f:
            content = await model.read()
            f.write(content)
        
        # Load the new model
        global walls_floors_model
        walls_floors_model = YOLO('real_interior_best.pt')
        
        return JSONResponse({
            "message": "Model uploaded and loaded successfully!",
            "filename": model.filename
        })
        
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Function to start the server
def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8001)  # Different port from your first API

# Start everything
print("🏠 Starting Walls/Floors Specialist API...")

# Start server in background
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

# Wait for server to start
time.sleep(5)

# Start ngrok tunnel
print("🌐 Creating public URL...")
public_url = ngrok.connect(8001)

print("\n" + "="*50)
print("✅ Walls/Floors API is ready!")
print(f"🌍 Public URL: {public_url}")
print("="*50)
print("📋 Copy this URL - you'll need it for your app")
print("="*50)

# Keep running
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopping server...")
    ngrok.kill()