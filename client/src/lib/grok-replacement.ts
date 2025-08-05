// Grok-powered object replacement service

export interface CropObjectRequest {
  imageUrl: string;
  segmentationMask: number[]; // Array of x,y coordinates forming the object boundary
}

export interface GenerateReplacementRequest {
  croppedObjectImage: string; // Base64 encoded cropped object
  replacementPrompt: string; // User's description of what they want
  originalImageUrl?: string; // For context
}

export interface CompleteReplacementRequest {
  imageUrl: string;
  segmentationMask: number[];
  replacementPrompt: string;
}

export interface CropResult {
  success: boolean;
  croppedImageBase64?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  error?: string;
}

export interface GenerateResult {
  success: boolean;
  generatedImageBase64?: string;
  revisedPrompt?: string;
  processingTime: number;
  error?: string;
}

export interface CompleteReplacementResult {
  success: boolean;
  finalImageBase64?: string;
  croppedObject?: string;
  generatedReplacement?: string;
  boundingBox?: any;
  revisedPrompt?: string;
  error?: string;
}

export class GrokReplacementService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Crop an object from the image using segmentation mask
   */
  async cropObject(request: CropObjectRequest): Promise<CropResult> {
    try {
      console.log('Cropping object using segmentation mask...');
      
      const response = await fetch(`${this.baseUrl}/api/grok/crop-object`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Crop request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Crop completed:', result.success);
      
      return result;
      
    } catch (error) {
      console.error('Crop error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown crop error'
      };
    }
  }

  /**
   * Generate replacement object using Grok image generation
   */
  async generateReplacement(request: GenerateReplacementRequest): Promise<GenerateResult> {
    try {
      console.log('Generating replacement with Grok...');
      console.log('Prompt:', request.replacementPrompt);
      
      const response = await fetch(`${this.baseUrl}/api/grok/generate-replacement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Generation request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Generation completed:', result.success);
      if (result.revisedPrompt) {
        console.log('Revised prompt:', result.revisedPrompt);
      }
      
      return result;
      
    } catch (error) {
      console.error('Generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generation error',
        processingTime: 0
      };
    }
  }

  /**
   * Complete object replacement workflow: crop + generate + place
   */
  async replaceObjectComplete(request: CompleteReplacementRequest): Promise<CompleteReplacementResult> {
    try {
      console.log('Starting complete Grok-powered replacement workflow...');
      
      const response = await fetch(`${this.baseUrl}/api/grok/replace-object`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Complete replacement failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Complete replacement workflow completed:', result.success);
      
      return result;
      
    } catch (error) {
      console.error('Complete replacement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown replacement error'
      };
    }
  }

  /**
   * Step-by-step workflow for more control
   */
  async replaceObjectStepByStep(
    imageUrl: string,
    segmentationMask: number[],
    replacementPrompt: string,
    onProgress?: (step: string, data?: any) => void
  ): Promise<CompleteReplacementResult> {
    try {
      // Step 1: Crop object
      onProgress?.('cropping', 'Extracting object from image...');
      const cropResult = await this.cropObject({ imageUrl, segmentationMask });
      
      if (!cropResult.success || !cropResult.croppedImageBase64) {
        return {
          success: false,
          error: `Cropping failed: ${cropResult.error}`
        };
      }

      onProgress?.('cropped', { croppedImage: cropResult.croppedImageBase64 });

      // Step 2: Generate replacement
      onProgress?.('generating', 'Creating new object with Grok AI...');
      const generateResult = await this.generateReplacement({
        croppedObjectImage: cropResult.croppedImageBase64,
        replacementPrompt,
        originalImageUrl: imageUrl
      });

      if (!generateResult.success || !generateResult.generatedImageBase64) {
        return {
          success: false,
          error: `Generation failed: ${generateResult.error}`,
          croppedObject: cropResult.croppedImageBase64
        };
      }

      onProgress?.('generated', { 
        generatedImage: generateResult.generatedImageBase64,
        revisedPrompt: generateResult.revisedPrompt 
      });

      // Step 3: The backend service handles placement
      onProgress?.('placing', 'Placing new object in original image...');
      
      // For now, return the components - placement is handled by the backend
      return {
        success: true,
        croppedObject: cropResult.croppedImageBase64,
        generatedReplacement: generateResult.generatedImageBase64,
        boundingBox: cropResult.boundingBox,
        revisedPrompt: generateResult.revisedPrompt
      };
      
    } catch (error) {
      console.error('Step-by-step replacement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown workflow error'
      };
    }
  }
}

// Create service instance
export const grokReplacementService = new GrokReplacementService();