// Test script to debug YOLO segmentation on DALL-E generated objects
const fs = require('fs');
const https = require('https');

// Simple test with a sample image
async function testYOLOSegmentation() {
  try {
    console.log('Testing YOLO API with sample image...');
    
    // Create a simple test image (1x1 pixel PNG in base64)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    // Convert to buffer
    const imageBuffer = Buffer.from(testImageBase64, 'base64');
    
    // Test 1: Try with form data approach
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: 'test.png',
      contentType: 'image/png'
    });
    
    console.log('Making YOLO API request...');
    const response = await fetch('https://8cd7e397f05e.ngrok-free.app/detect', {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('Raw response:', result);
    
    if (response.ok) {
      const jsonResult = JSON.parse(result);
      console.log('Parsed result:', JSON.stringify(jsonResult, null, 2));
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testYOLOSegmentation();