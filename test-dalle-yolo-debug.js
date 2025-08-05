// Test YOLO detection on DALL-E generated images
const fs = require('fs');

async function testYoloOnDallE() {
  try {
    console.log('🧪 Testing YOLO detection on DALL-E style image...');
    
    // Simple test image - create a basic chair image for YOLO to detect
    const testImageBase64 = 'data:image/svg+xml;base64,' + Buffer.from(`
      <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect x="100" y="50" width="100" height="200" fill="#8B4513" stroke="#654321" stroke-width="2"/>
        <rect x="80" y="40" width="140" height="20" fill="#8B4513" stroke="#654321" stroke-width="2"/>
        <rect x="90" y="250" width="20" height="40" fill="#8B4513"/>
        <rect x="190" y="250" width="20" height="40" fill="#8B4513"/>
      </svg>
    `).toString('base64');
    
    const response = await fetch('https://8cd7e397f05e.ngrok-free.app/detect-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        image_url: testImageBase64
      })
    });
    
    if (!response.ok) {
      throw new Error(`API failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('YOLO detected objects in test chair:', result);
    console.log(`Found ${(result.objects || result.detections || []).length} objects`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testYoloOnDallE();