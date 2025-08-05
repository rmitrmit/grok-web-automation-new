// YOLO11 Backend API Integration  
// Supports COCO 80-class detection with instance segmentation
export class YOLO11APIDetector {
  private apiEndpoint: string;
  private useCustomModel: boolean;
  
  // COCO 80 classes that YOLO11 can detect with segmentation
  private readonly supportedClasses = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
    'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
    'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
    'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
    'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
    'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
    'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
    'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
  ];

  // Progressive model classes for incremental training
  private readonly modelVersions = {
    'walls_floors': ['wall', 'floor', 'ceiling'],
    'furniture': ['wall', 'floor', 'ceiling', 'chair', 'table', 'couch', 'lamp'],
    'complete': ['wall', 'floor', 'ceiling', 'chair', 'table', 'couch', 'lamp', 'cabinet', 'tv', 'plant', 'artwork', 'curtain']
  };

  constructor(apiEndpoint: string = 'https://555d23bb89c8.ngrok-free.app', useCustomModel: boolean = true, private modelVersion: string = 'walls_floors') {
    this.apiEndpoint = apiEndpoint;
    this.useCustomModel = useCustomModel;
  }

  // Check if an object type can be segmented by YOLO
  canSegment(objectName: string): boolean {
    const name = objectName.toLowerCase();
    if (this.useCustomModel) {
      const customClasses = this.modelVersions[this.modelVersion as keyof typeof this.modelVersions] || this.modelVersions['complete'];
      return customClasses.includes(name) || this.supportedClasses.includes(name);
    }
    return this.supportedClasses.includes(name);
  }

  // Get YOLO-compatible class name
  mapToYOLOClass(objectName: string): string | null {
    const name = objectName.toLowerCase();
    
    // Direct matches
    if (this.supportedClasses.includes(name)) {
      return name;
    }
    
    // Common mappings for similar objects
    const mappings: Record<string, string> = {
      'sofa': 'couch',
      'table': 'dining table', 
      'television': 'tv',
      'plant': 'potted plant',
      'lamp': 'tv', // Best approximate (both can emit light)
      'lighting': 'tv', // Best approximate
      'picture frame': 'book', // Both are flat rectangular objects
      'cabinetry': 'refrigerator', // Both are large appliances/furniture
    };
    
    return mappings[name] || null;
  }

  async detectObjects(imageElement: HTMLImageElement, drawingPath?: { x: number; y: number }[]): Promise<any[]> {
    try {
      const imageUrl = imageElement.src;
      console.log(`Running YOLO11 detection${this.useCustomModel ? ' (custom model)' : ' (base model)'}...`);
      
      // Check if it's a data URL (uploaded image)
      if (imageUrl.startsWith('data:')) {
        // Convert to blob and send as file upload
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('file', blob, 'uploaded_image.jpg');
        if (drawingPath) {
          formData.append('drawing_path', JSON.stringify(drawingPath));
        }
        formData.append('use_custom_model', this.useCustomModel.toString());
        formData.append('model_version', this.modelVersion);

        // Send to regular /detect endpoint for uploaded files
        const apiResponse = await fetch(`${this.apiEndpoint}/detect`, {
          method: 'POST',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
        });

        if (!apiResponse.ok) {
          throw new Error(`API request failed: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();
        console.log('YOLO11 API detected objects (file upload):', result.objects);
        return result.objects || [];
      } else {
        // For external URLs, we need to download the image first and send as file
        console.log('Downloading external image for YOLO11 API...');
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();
        
        const formData = new FormData();
        formData.append('file', imageBlob, 'external_image.jpg');
        if (drawingPath) {
          formData.append('drawing_path', JSON.stringify(drawingPath));
        }
        formData.append('use_custom_model', this.useCustomModel.toString());
        formData.append('model_version', this.modelVersion);

        const response = await fetch(`${this.apiEndpoint}/detect`, {
          method: 'POST',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('YOLO11 API detected objects (external URL):', result.objects);
        return result.objects || [];
      }
      
    } catch (error) {
      console.error('YOLO11 API detection failed:', error);
      console.log(`API endpoint: ${this.apiEndpoint}`);
      console.log('Error details:', error instanceof Error ? error.message : String(error));
      
      // More specific error messages
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        throw new Error(`YOLO11 API server at ${this.apiEndpoint} is not accessible. Check if the ngrok tunnel is running.`);
      } else if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`YOLO11 API endpoint not found. Check if the server has the correct routes.`);
      } else {
        throw error;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Create instances for both general and specialized APIs
export const yolo11APIDetector = new YOLO11APIDetector(
  // General YOLO API - your live server
  import.meta.env.VITE_YOLO11_API_URL || 'https://555d23bb89c8.ngrok-free.app',
  false // Base model for general detection
);

export const wallsFloorsYOLODetector = new YOLO11APIDetector(
  // Specialized walls/floors API - same server but with custom model parameter
  import.meta.env.VITE_YOLO11_WALLS_FLOORS_API_URL || 'https://8cd7e397f05e.ngrok-free.app',
  true, // Custom model for walls/floors
  'walls_floors' // Model version
);