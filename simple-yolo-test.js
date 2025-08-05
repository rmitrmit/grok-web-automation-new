// Simplified YOLO test with curl-like approach
const fs = require('fs');

async function simpleYOLOTest() {
  try {
    // Test the YOLO API health first
    console.log('Testing YOLO API health...');
    const healthResponse = await fetch('https://8cd7e397f05e.ngrok-free.app/', {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    const healthData = await healthResponse.text();
    console.log('Health check:', healthData);
    
    // Now test with a minimal approach - just check what the API expects
    console.log('Testing API endpoint structure...');
    const testResponse = await fetch('https://8cd7e397f05e.ngrok-free.app/detect', {
      method: 'POST',
      headers: { 
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    console.log('Test response status:', testResponse.status);
    const testData = await testResponse.text();
    console.log('Test response:', testData);
    
  } catch (error) {
    console.error('Simple test failed:', error.message);
  }
}

simpleYOLOTest();