// Test YOLO API with ES modules
import FormData from 'form-data';

async function testYOLOAPI() {
  try {
    console.log('Testing YOLO API health...');
    
    // Test health endpoint
    const healthResponse = await fetch('https://039a5b2663c7.ngrok-free.app/', {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    const healthText = await healthResponse.text();
    console.log('Health response:', healthText);
    
    // Create a simple test image buffer
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(testImageBase64, 'base64');
    
    console.log('\nTesting YOLO detection with FormData...');
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: 'test.png',
      contentType: 'image/png'
    });
    
    const response = await fetch('https://039a5b2663c7.ngrok-free.app/detect', {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log('YOLO response status:', response.status);
    console.log('YOLO response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('YOLO response body:', responseText);
    
    if (response.ok) {
      try {
        const jsonData = JSON.parse(responseText);
        console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
        
        // Check for objects/detections
        const objects = jsonData.objects || jsonData.detections || [];
        console.log(`Found ${objects.length} objects`);
        
        if (objects.length > 0) {
          const obj = objects[0];
          console.log('First object:', obj);
          console.log('Segmentation data:', obj.refinedPath || obj.segmentation || obj.mask || 'No segmentation data');
        }
      } catch (parseError) {
        console.log('Response is not JSON:', parseError.message);
      }
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testYOLOAPI();