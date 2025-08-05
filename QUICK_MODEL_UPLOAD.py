# Quick Model Upload - Run this AFTER the server is running
# Upload your real_interior_best.pt model to the server

from google.colab import files
import requests
import os

print("📤 Upload your real_interior_best.pt model file:")
print("(Select the file you downloaded from Google Drive)")

# Upload file
uploaded = files.upload()

# Find the uploaded model file
model_file = None
for filename in uploaded.keys():
    if filename.endswith('.pt'):
        model_file = filename
        break

if not model_file:
    print("❌ No .pt model file found in upload")
else:
    print(f"✅ Found model file: {model_file}")
    
    # Rename to standard name if needed
    if model_file != 'real_interior_best.pt':
        os.rename(model_file, 'real_interior_best.pt')
        print("📝 Renamed to: real_interior_best.pt")
    
    print("✅ Model uploaded successfully!")
    print("🔄 The server will automatically load the model")
    print("🎯 Your app can now use the walls/floors custom model")
    
    # Verify model is loaded
    if os.path.exists('real_interior_best.pt'):
        file_size = os.path.getsize('real_interior_best.pt')
        print(f"📊 Model file size: {file_size / (1024*1024):.1f} MB")