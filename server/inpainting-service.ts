// Object Removal & Inpainting Service
// Uses LaMa (Samsung's AI) for professional object removal and background filling
import OpenAI from "openai";
import sharp from 'sharp';

interface ObjectRemovalRequest {
  imageUrl: string;
  maskCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  objectMask?: string; // Base64 encoded mask from YOLO segmentation
}

interface ObjectRemovalResult {
  success: boolean;
  cleanedImageUrl: string;
  processingTime: number;
  method: string;
}

export class InpaintingService {
  private lamaApiUrl: string;
  private openai: OpenAI;
  
  constructor() {
    // Use local LaMa server or cloud service
    this.lamaApiUrl = process.env.LAMA_API_URL || 'http://localhost:8080';
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Remove object and fill background using LaMa inpainting
   * Step 1 of the two-step replacement process
   */
  async removeObject(request: ObjectRemovalRequest): Promise<ObjectRemovalResult> {
    const startTime = Date.now();
    
    try {
      console.log('Starting object removal with LaMa inpainting...');
      
      // Create mask from object bounds if segmentation mask not provided
      const mask = request.objectMask || await this.createBoundingBoxMask(
        request.imageUrl,
        request.maskCoordinates
      );
      
      // Send to LaMa inpainting service
      const formData = new FormData();
      
      // Fetch and add the image
      const imageResponse = await fetch(request.imageUrl);
      const imageBlob = await imageResponse.blob();
      formData.append('image', imageBlob, 'image.jpg');
      
      // Add the mask
      const maskBlob = this.base64ToBlob(mask);
      formData.append('mask', maskBlob, 'mask.png');
      
      // Send to LaMa API
      const response = await fetch(`${this.lamaApiUrl}/inpaint`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`LaMa API failed: ${response.status}`);
      }
      
      const resultBlob = await response.blob();
      const cleanedImageUrl = await this.blobToDataUrl(resultBlob);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`Object removal completed in ${processingTime}ms`);
      
      return {
        success: true,
        cleanedImageUrl,
        processingTime,
        method: 'LaMa'
      };
      
    } catch (error) {
      console.error('LaMa inpainting failed, trying fallback...', error);
      
      // Fallback to simple content-aware fill
      return await this.fallbackRemoval(request);
    }
  }

  /**
   * Fallback object removal using OpenAI DALL-E inpainting  
   */
  private async fallbackRemoval(request: ObjectRemovalRequest): Promise<ObjectRemovalResult> {
    const startTime = Date.now();
    
    try {
      console.log('Using OpenAI inpainting as fallback...');
      
      // Download the original image first to get dimensions
      const imageResponse = await fetch(request.imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const { width: originalWidth, height: originalHeight } = await sharp(imageBuffer).metadata();
      
      if (!originalWidth || !originalHeight) {
        throw new Error('Could not get original image dimensions');
      }
      
      // Convert image to PNG with RGBA format for OpenAI (1024x1024)
      const processedImage = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .ensureAlpha()
        .png()
        .toBuffer();
      
      // Create mask at original size, then resize to 1024x1024 to match image
      const originalMask = await this.createSimpleMask(request.imageUrl, request.maskCoordinates);
      const originalMaskBuffer = Buffer.from(originalMask, 'base64');
      
      // Resize mask to 1024x1024 to match the processed image
      // Background should be BLACK (keep) when resizing
      const resizedMaskBuffer = await sharp(originalMaskBuffer)
        .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .ensureAlpha()
        .png()
        .toBuffer();
      
      console.log(`Original image: ${originalWidth}x${originalHeight}`);
      console.log(`Processed image size: ${processedImage.length} bytes (1024x1024)`);
      console.log(`Resized mask size: ${resizedMaskBuffer.length} bytes (1024x1024)`);
      console.log('Mask logic: WHITE areas = object to remove, BLACK areas = background to keep');
      
      // Save mask for debugging (temporary)
      const maskDebugPath = `/tmp/debug_mask_${Date.now()}.png`;
      await sharp(resizedMaskBuffer).png().toFile(maskDebugPath);
      console.log(`Debug mask saved to: ${maskDebugPath}`);
      
      // Prepare form data for OpenAI with properly sized mask
      const formData = new FormData();
      formData.append('image', new Blob([processedImage], { type: 'image/png' }), 'image.png');
      formData.append('mask', new Blob([resizedMaskBuffer], { type: 'image/png' }), 'mask.png');
      formData.append('prompt', 'a room with natural wall and floor background, clean and empty space where furniture was removed');
      formData.append('n', '1');
      formData.append('size', '1024x1024');
      
      // Call OpenAI Image Edit API (DALL-E 2)
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData
      });
      
      console.log('OpenAI API request sent with WHITE=remove, BLACK=keep mask format');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error ${response.status}:`, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      const cleanedImageUrl = result.data[0].url;
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        cleanedImageUrl,
        processingTime,
        method: 'OpenAI-Inpainting'
      };
      
    } catch (error) {
      console.error('OpenAI inpainting failed:', error);
      throw new Error('Object removal failed');
    }
  }

  /**
   * Create a simple canvas-based mask (simplified approach)
   */
  private async createSimpleMask(
    imageUrl: string, 
    bounds: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    try {
      // Download the original image to get dimensions
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const { width, height } = await sharp(imageBuffer).metadata();
      
      if (!width || !height) {
        throw new Error('Could not get image dimensions');
      }
      
      console.log(`Creating simple mask for ${width}x${height} image, object at (${bounds.x},${bounds.y}) size ${bounds.width}x${bounds.height}`);
      
      // Create a simple black image with white rectangle
      const padding = 10;
      const maskX = Math.max(0, Math.floor(bounds.x - padding));
      const maskY = Math.max(0, Math.floor(bounds.y - padding));
      const maskWidth = Math.min(width - maskX, Math.floor(bounds.width + padding * 2));
      const maskHeight = Math.min(height - maskY, Math.floor(bounds.height + padding * 2));
      
      // Create a simple mask with RGBA format (required by OpenAI)
      // NOTE: In OpenAI inpainting, WHITE areas are removed/replaced, BLACK areas are kept
      const maskData = Buffer.alloc(width * height * 4, 0); // Start with BLACK (all will be kept)
      
      // Fill WHITE rectangle ONLY for the object area (to remove the object)
      for (let y = maskY; y < maskY + maskHeight && y < height; y++) {
        for (let x = maskX; x < maskX + maskWidth && x < width; x++) {
          const idx = (y * width + x) * 4;
          maskData[idx] = 255;     // R - WHITE to remove this area
          maskData[idx + 1] = 255; // G - WHITE to remove this area
          maskData[idx + 2] = 255; // B - WHITE to remove this area
          maskData[idx + 3] = 255; // A (alpha)
        }
      }
      
      // Convert to PNG using Sharp with RGBA
      const mask = await sharp(maskData, {
        raw: {
          width: width,
          height: height,
          channels: 4
        }
      }).png().toBuffer();
      
      return mask.toString('base64');
      
    } catch (error) {
      console.error('Failed to create simple mask:', error);
      throw error;
    }
  }

  /**
   * Create a mask from bounding box coordinates using sharp
   */
  private async createBoundingBoxMask(
    imageUrl: string, 
    bounds: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    try {
      // Download the original image to get dimensions
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      // Get image dimensions
      const { width, height } = await sharp(imageBuffer).metadata();
      
      if (!width || !height) {
        throw new Error('Could not get image dimensions');
      }
      
      console.log(`Creating mask for ${width}x${height} image, object at (${bounds.x},${bounds.y}) size ${bounds.width}x${bounds.height}`);
      
      // Create a simple black image with white rectangle for the object area
      const padding = 10;
      const maskX = Math.max(0, bounds.x - padding);
      const maskY = Math.max(0, bounds.y - padding);
      const maskWidth = Math.min(width - maskX, bounds.width + padding * 2);
      const maskHeight = Math.min(height - maskY, bounds.height + padding * 2);
      
      // Ensure valid dimensions
      const validMaskWidth = Math.max(1, Math.min(width - maskX, maskWidth));
      const validMaskHeight = Math.max(1, Math.min(height - maskY, maskHeight));
      
      console.log(`Creating mask: ${width}x${height}, white area: ${maskX},${maskY} ${validMaskWidth}x${validMaskHeight}`);
      
      // Create black background
      const blackBackground = await sharp({
        create: {
          width: Math.floor(width),
          height: Math.floor(height),
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      });
      
      // Create white rectangle for the object area
      const whiteRect = await sharp({
        create: {
          width: Math.floor(validMaskWidth),
          height: Math.floor(validMaskHeight),
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      });
      
      // Composite the white rectangle onto the black background
      const mask = await blackBackground
        .composite([{
          input: await whiteRect.png().toBuffer(),
          top: Math.floor(maskY),
          left: Math.floor(maskX)
        }])
        .png()
        .toBuffer();
      
      // Convert to base64
      return mask.toString('base64');
      
    } catch (error) {
      console.error('Failed to create mask:', error);
      throw error;
    }
  }



  /**
   * Utility: Convert base64 to blob
   */
  private base64ToBlob(base64: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/png' });
  }

  /**
   * Utility: Convert blob to data URL
   */
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }



  /**
   * Check if LaMa service is available
   */
  async isLamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.lamaApiUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const inpaintingService = new InpaintingService();