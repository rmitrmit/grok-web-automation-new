import OpenAI from 'openai';
import sharp from 'sharp';

// Use OpenAI SDK with xAI base URL for Grok image generation (fallback to OpenAI if no credits)
const grokClient = new OpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
});

// OpenAI client for fallback when Grok has no credits
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CropImageRequest {
  imageUrl: string;
  segmentationMask: number[]; // Array of x,y coordinates forming the object boundary
}

export interface GenerateReplacementRequest {
  croppedObjectImage: string; // Base64 encoded cropped object
  replacementPrompt: string; // User's description of what they want
  originalImageUrl: string; // For context
}

export interface CropImageResult {
  success: boolean;
  croppedImageUrl?: string;
  croppedImageBase64?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  error?: string;
}

export interface GenerateReplacementResult {
  success: boolean;
  generatedImageUrl?: string;
  generatedImageBase64?: string;
  revisedPrompt?: string;
  processingTime: number;
  error?: string;
}

export class GrokImageService {
  
  /**
   * Crop object from image using segmentation coordinates
   */
  async cropObjectFromImage(request: CropImageRequest): Promise<CropImageResult> {
    const startTime = Date.now();
    
    try {
      console.log('Cropping object from image using segmentation mask...');
      
      // Download the original image
      const imageResponse = await fetch(request.imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const { width: imgWidth, height: imgHeight } = await sharp(imageBuffer).metadata();
      
      if (!imgWidth || !imgHeight) {
        throw new Error('Could not get image dimensions');
      }
      
      // Convert segmentation coordinates to bounding box
      const points = request.segmentationMask;
      const xCoords = [];
      const yCoords = [];
      
      for (let i = 0; i < points.length; i += 2) {
        xCoords.push(points[i]);
        yCoords.push(points[i + 1]);
      }
      
      const minX = Math.max(0, Math.floor(Math.min(...xCoords)));
      const maxX = Math.min(imgWidth, Math.ceil(Math.max(...xCoords)));
      const minY = Math.max(0, Math.floor(Math.min(...yCoords)));
      const maxY = Math.min(imgHeight, Math.ceil(Math.max(...yCoords)));
      
      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;
      
      console.log(`Bounding box: ${minX},${minY} ${cropWidth}x${cropHeight}`);
      
      // Create a mask for the segmented area
      const maskSvg = `
        <svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="objectMask">
              <rect width="100%" height="100%" fill="black"/>
              <polygon points="${points.join(' ')}" fill="white"/>
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="transparent" mask="url(#objectMask)"/>
        </svg>
      `;
      
      // Apply mask and crop
      const maskedImage = await sharp(imageBuffer)
        .composite([{
          input: Buffer.from(maskSvg),
          blend: 'dest-in'
        }])
        .png()
        .toBuffer();
      
      // Crop to bounding box
      const croppedImage = await sharp(maskedImage)
        .extract({
          left: minX,
          top: minY,
          width: cropWidth,
          height: cropHeight
        })
        .png()
        .toBuffer();
      
      // Convert to base64
      const croppedBase64 = croppedImage.toString('base64');
      
      console.log(`Object cropped successfully: ${cropWidth}x${cropHeight}px`);
      
      return {
        success: true,
        croppedImageBase64: croppedBase64,
        boundingBox: {
          x: minX,
          y: minY,
          width: cropWidth,
          height: cropHeight
        }
      };
      
    } catch (error) {
      console.error('Crop error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cropping error'
      };
    }
  }
  
  /**
   * Generate full scene replacement using DALL-E with difference detection
   */
  async generateSceneReplacement(request: GenerateReplacementRequest & { 
    originalImageBase64: string;
    objectName: string;
  }): Promise<GenerateReplacementResult & { 
    originalImageBase64?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('Generating full scene replacement with DALL-E...');
      console.log('Object to replace:', request.objectName);
      console.log('User prompt:', request.replacementPrompt);
      
      // Create enhanced prompt for full scene modification
      const enhancedPrompt = `Change the ${request.objectName} to ${request.replacementPrompt}, don't change anything else. Keep the same room layout, lighting, perspective, and all other objects exactly the same. Only modify the ${request.objectName} as requested.`;
      
      console.log('Enhanced scene prompt:', enhancedPrompt);
      
      // Try Grok first, fallback to OpenAI DALL-E if no credits
      let response;
      let usingFallback = false;
      
      try {
        console.log('Attempting Grok scene generation...');
        response = await grokClient.images.generate({
          model: "dall-e-3",
          prompt: enhancedPrompt + '. Interior room scene, realistic lighting, high quality photograph style.',
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "b64_json"
        });
        console.log('✅ Grok scene generation successful');
      } catch (grokError: any) {
        console.log('⚠️ Grok failed, falling back to OpenAI DALL-E...');
        console.log('Grok error:', grokError?.message || 'Unknown error');
        
        usingFallback = true;
        response = await openaiClient.images.generate({
          model: "dall-e-3",
          prompt: enhancedPrompt + '. Interior room scene, realistic lighting, high quality photograph style.',
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "b64_json"
        });
        console.log('✅ OpenAI DALL-E fallback successful');
      }
      
      const result = response.data?.[0];
      if (!result) {
        throw new Error('No image generated by DALL-E');
      }
      const processingTime = Date.now() - startTime;
      
      console.log(`OpenAI DALL-E scene generation completed in ${processingTime}ms`);
      
      return {
        success: true,
        generatedImageBase64: result.b64_json,
        originalImageBase64: request.originalImageBase64,
        revisedPrompt: enhancedPrompt,
        processingTime
      };
      
    } catch (error) {
      console.error('OpenAI DALL-E scene generation error:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown scene generation error',
        processingTime
      };
    }
  }

  /**
   * Simplified approach: Just use the generated image directly with segmentation mask
   * Since we can't do true scene editing, we'll use the generated object with mask overlay
   */
  async extractObjectFromGenerated(
    generatedBase64: string,
    segmentationMask: number[]
  ): Promise<{
    success: boolean;
    extractedObjectBase64?: string;
    error?: string;
  }> {
    try {
      console.log('Extracting object from generated image using segmentation mask...');
      
      const generatedBuffer = Buffer.from(generatedBase64, 'base64');
      
      // Keep original dimensions instead of forcing 1024x1024
      const generatedImage = await sharp(generatedBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const { data: generatedData, info } = generatedImage;
      
      // Create mask from segmentation coordinates using image dimensions
      const maskSvg = this.createSegmentationMaskSVG(segmentationMask, info.width, info.height);
      const maskBuffer = await sharp(Buffer.from(maskSvg))
        .resize(info.width, info.height)
        .greyscale()
        .raw()
        .toBuffer();
      
      // Create RGBA buffer for the extracted object with anti-aliasing
      const rgbaBuffer = Buffer.alloc(info.width * info.height * 4);
      
      for (let i = 0, rgbaIndex = 0, maskIndex = 0; i < generatedData.length; i += 3, rgbaIndex += 4, maskIndex++) {
        const maskValue = maskBuffer[maskIndex];
        const isInMask = maskValue > 128;
        
        if (isInMask) {
          // Inside mask - use generated image pixels with smooth alpha
          rgbaBuffer[rgbaIndex] = generatedData[i];     // R
          rgbaBuffer[rgbaIndex + 1] = generatedData[i + 1]; // G
          rgbaBuffer[rgbaIndex + 2] = generatedData[i + 2]; // B
          rgbaBuffer[rgbaIndex + 3] = maskValue; // Use mask value for smooth edges
        } else {
          // Outside mask - transparent
          rgbaBuffer[rgbaIndex] = 0;     // R
          rgbaBuffer[rgbaIndex + 1] = 0; // G
          rgbaBuffer[rgbaIndex + 2] = 0; // B
          rgbaBuffer[rgbaIndex + 3] = 0; // Transparent
        }
      }
      
      // Convert to PNG with transparency
      const extractedImage = await sharp(rgbaBuffer, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      })
      .png()
      .toBuffer();
      
      console.log('✅ Successfully extracted object from generated image');
      
      return {
        success: true,
        extractedObjectBase64: extractedImage.toString('base64')
      };
      
    } catch (error) {
      console.error('Object extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Object extraction failed'
      };
    }
  }
  
  /**
   * New scene-based replacement workflow: generate full scene + extract differences
   */
  async replaceObjectWithSceneDiff(
    imageUrl: string,
    segmentationMask: number[],
    replacementPrompt: string,
    objectName: string
  ): Promise<{
    success: boolean;
    finalImageBase64?: string;
    originalScene?: string;
    generatedScene?: string;
    extractedDifferences?: string;
    revisedPrompt?: string;
    error?: string;
  }> {
    try {
      console.log('🔄 Starting NEW scene-based replacement workflow...');
      console.log(`Object: ${objectName} → Prompt: ${replacementPrompt}`);
      
      // Step 1: Get original image and its dimensions
      const originalResponse = await fetch(imageUrl);
      const originalBuffer = await originalResponse.arrayBuffer();
      const originalBase64 = Buffer.from(originalBuffer).toString('base64');
      
      // Get original image dimensions for coordinate scaling
      const originalMetadata = await sharp(Buffer.from(originalBuffer)).metadata();
      const originalWidth = originalMetadata.width || 800;
      const originalHeight = originalMetadata.height || 600;
      
      console.log(`Step 1: Original image loaded - ${originalWidth}x${originalHeight}`);
      
      // Step 2: Generate full scene with modifications  
      const sceneResult = await this.generateSceneReplacement({
        replacementPrompt,
        originalImageBase64: originalBase64,
        objectName,
        croppedObjectImage: '', // Not needed for scene-based
        originalImageUrl: imageUrl
      });
      
      if (!sceneResult.success || !sceneResult.generatedImageBase64) {
        throw new Error(`Scene generation failed: ${sceneResult.error}`);
      }
      
      console.log('Step 2: Full scene generated with modifications');
      
      // Step 3: Extract the new object from generated scene using scaled mask
      // Scale segmentation mask coordinates from original to generated image dimensions (1024x1024)
      const scaleX = 1024 / originalWidth;
      const scaleY = 1024 / originalHeight;
      const scaledSegmentationMask = segmentationMask.map((coord, index) => {
        return index % 2 === 0 ? coord * scaleX : coord * scaleY;
      });
      
      console.log(`Scaling mask coordinates: ${originalWidth}x${originalHeight} → 1024x1024`);
      
      const extractResult = await this.extractObjectFromGenerated(
        sceneResult.generatedImageBase64,
        scaledSegmentationMask
      );
      
      if (!extractResult.success || !extractResult.extractedObjectBase64) {
        throw new Error(`Object extraction failed: ${extractResult.error}`);
      }
      
      console.log('Step 3: New object extracted successfully');
      
      // Step 4: Precise segmentation-based placement with masking
      console.log('Step 4: Applying precise segmentation-based object placement...');
      
      const originalImageBuffer = Buffer.from(originalBase64, 'base64');
      
      // Get original image dimensions to preserve aspect ratio
      const finalMetadata = await sharp(originalImageBuffer).metadata();
      const finalWidth = finalMetadata.width || 800;
      const finalHeight = finalMetadata.height || 600;
      
      console.log(`Preserving original dimensions: ${finalWidth}x${finalHeight}`);
      
      // Create precise segmentation mask for original image dimensions
      const originalMaskSvg = this.createSegmentationMaskSVG(segmentationMask, finalWidth, finalHeight);
      const originalMaskBuffer = await sharp(Buffer.from(originalMaskSvg))
        .resize(finalWidth, finalHeight)
        .png()
        .toBuffer();
      
      // Get the generated scene and resize it to match original dimensions
      const generatedSceneBuffer = Buffer.from(sceneResult.generatedImageBase64, 'base64');
      const resizedGeneratedScene = await sharp(generatedSceneBuffer)
        .resize(finalWidth, finalHeight, { 
          fit: 'fill',
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .png()
        .toBuffer();
      
      // Apply the segmentation mask to the generated scene to extract only the object area
      const maskedGeneratedObject = await sharp(resizedGeneratedScene)
        .composite([{
          input: originalMaskBuffer,
          blend: 'dest-in' // Keep only pixels where mask is white
        }])
        .png()
        .toBuffer();
      
      // Create inverted mask to remove the original object area
      const invertedMask = await sharp(originalMaskBuffer)
        .negate()
        .png()
        .toBuffer();
      
      // Remove the original object from the original image
      const originalWithoutObject = await sharp(originalImageBuffer)
        .composite([{
          input: invertedMask,
          blend: 'dest-in' // Keep everything except the masked area
        }])
        .png()
        .toBuffer();
      
      // Combine the original image (without object) with the new masked object
      const finalImage = await sharp(originalWithoutObject)
        .composite([{
          input: maskedGeneratedObject,
          blend: 'over' // Overlay the new object
        }])
        .png()
        .toBuffer();
        
      console.log('✅ Precise segmentation-based compositing completed');
      
      console.log('Step 4: Final composite image created');
      console.log('✅ NEW scene-based replacement workflow completed successfully!');
      
      return {
        success: true,
        finalImageBase64: finalImage.toString('base64'),
        originalScene: originalBase64,
        generatedScene: sceneResult.generatedImageBase64,
        extractedDifferences: extractResult.extractedObjectBase64,
        revisedPrompt: sceneResult.revisedPrompt
      };
      
    } catch (error) {
      console.error('Scene-based replacement workflow error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scene replacement workflow failed'
      };
    }
  }

  /**
   * Complete object replacement workflow: crop + generate + place
   */
  async replaceObject(
    imageUrl: string,
    segmentationMask: number[],
    replacementPrompt: string
  ): Promise<{
    success: boolean;
    finalImageBase64?: string;
    croppedObject?: string;
    generatedReplacement?: string;
    boundingBox?: any;
    revisedPrompt?: string;
    error?: string;
  }> {
    try {
      console.log('Starting complete object replacement workflow...');
      
      // Step 1: Crop the original object
      const cropResult = await this.cropObjectFromImage({
        imageUrl,
        segmentationMask
      });
      
      if (!cropResult.success || !cropResult.croppedImageBase64) {
        throw new Error(`Cropping failed: ${cropResult.error}`);
      }
      
      // This method is deprecated - use replaceObjectWithSceneDiff instead
      throw new Error('This method is deprecated. Use replaceObjectWithSceneDiff instead.');
      
    } catch (error) {
      console.error('Complete replacement workflow error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown workflow error'
      };
    }
  }
  
  /**
   * Place generated object back into original image
   */
  private async placeGeneratedObject(
    originalImageUrl: string,
    generatedObjectBase64: string,
    boundingBox: { x: number; y: number; width: number; height: number }
  ): Promise<{ success: boolean; finalImageBase64?: string; error?: string }> {
    try {
      console.log('Placing generated object back into original image...');
      
      // Load original image
      const originalResponse = await fetch(originalImageUrl);
      const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
      
      // Decode generated object
      const generatedBuffer = Buffer.from(generatedObjectBase64, 'base64');
      
      // Resize generated object to fit bounding box
      const resizedGenerated = await sharp(generatedBuffer)
        .resize(boundingBox.width, boundingBox.height, {
          fit: 'fill',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      // Composite the new object onto the original image
      const finalImage = await sharp(originalBuffer)
        .composite([{
          input: resizedGenerated,
          top: boundingBox.y,
          left: boundingBox.x,
          blend: 'over'
        }])
        .png()
        .toBuffer();
      
      const finalBase64 = finalImage.toString('base64');
      
      console.log('Object placement completed successfully');
      
      return {
        success: true,
        finalImageBase64: finalBase64
      };
      
    } catch (error) {
      console.error('Placement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown placement error'
      };
    }
  }

  /**
   * Place generated object back into original image using segmentation mask for precise placement
   */
  private async placeGeneratedObjectWithMask(
    originalImageUrl: string,
    generatedObjectBase64: string,
    segmentationMask: number[],
    boundingBox: { x: number; y: number; width: number; height: number }
  ): Promise<{ success: boolean; finalImageBase64?: string; error?: string }> {
    try {
      console.log('🎯 PROPER WORKFLOW: Remove old (curved) + Segment DALL-E + Place segmented object');
      
      // Step 1: Remove the old object using precise YOLO segmentation boundaries
      console.log('Step 1: Removing old object using precise segmentation boundaries...');
      const cleanImage = await this.removeObjectWithPreciseSegmentation(originalImageUrl, segmentationMask);
      
      if (!cleanImage.success || !cleanImage.cleanImageBase64) {
        throw new Error(`Failed to remove old object: ${cleanImage.error}`);
      }
      
      // Step 2: Run YOLO segmentation on the generated DALL-E object to extract just the object
      console.log('Step 2: Running YOLO segmentation on DALL-E image to extract object only...');
      const segmentedNewObject = await this.segmentGeneratedObject(generatedObjectBase64);
      
      let objectToPlace = generatedObjectBase64;
      if (segmentedNewObject.success && segmentedNewObject.segmentedObjectBase64) {
        console.log('✅ SUCCESS: YOLO segmented DALL-E object - extracted just the object part');
        objectToPlace = segmentedNewObject.segmentedObjectBase64;
      } else {
        console.log('❌ YOLO segmentation failed - falling back to full DALL-E image');
        console.log(`Segmentation error: ${segmentedNewObject.error}`);
      }
      
      // Step 3: Place the new object (segmented or original) into the cleaned image
      console.log('Step 3: Placing new object into cleaned image...');
      const cleanImageBuffer = Buffer.from(cleanImage.cleanImageBase64, 'base64');
      const objectBuffer = Buffer.from(objectToPlace, 'base64');
      
      // Resize new object to fit bounding box while maintaining aspect ratio
      const resizedObject = await sharp(objectBuffer)
        .resize(boundingBox.width, boundingBox.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      // Place the new object in the cleaned image
      const finalImage = await sharp(cleanImageBuffer)
        .composite([{
          input: resizedObject,
          top: boundingBox.y,
          left: boundingBox.x,
          blend: 'over'
        }])
        .png()
        .toBuffer();
      
      const finalBase64 = finalImage.toString('base64');
      
      console.log(`✅ Replacement completed: old removed with curves, new object ${segmentedNewObject.success ? 'SEGMENTED from DALL-E' : 'FULL DALL-E (segmentation failed)'}`);
      
      return {
        success: true,
        finalImageBase64: finalBase64
      };
      
    } catch (error) {
      console.error('Advanced placement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown placement error'
      };
    }
  }

  /**
   * Remove object from image using precise YOLO segmentation boundaries (not bounding box)
   */
  private async removeObjectWithPreciseSegmentation(
    imageUrl: string,
    segmentationMask: number[]
  ): Promise<{ success: boolean; cleanImageBase64?: string; error?: string }> {
    try {
      console.log('Removing object using precise YOLO segmentation boundaries...');
      
      // Load original image
      const originalResponse = await fetch(imageUrl);
      const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
      const { width: imgWidth, height: imgHeight } = await sharp(originalBuffer).metadata();
      
      if (!imgWidth || !imgHeight) {
        throw new Error('Could not get image dimensions');
      }
      
      // Create precise segmentation mask from YOLO coordinates
      const maskSvg = this.createSegmentationMaskSVG(segmentationMask, imgWidth, imgHeight);
      const maskBuffer = Buffer.from(maskSvg);
      
      // Convert SVG mask to PNG
      const pngMask = await sharp(maskBuffer)
        .resize(imgWidth, imgHeight)
        .png()
        .toBuffer();
      
      // Create inverted mask for content-aware fill (black = remove, white = keep)
      const invertedMask = await sharp(pngMask)
        .negate()
        .png()
        .toBuffer();
      
      // Simple inpainting approach: blur the entire image and use it to fill the masked area
      const blurredBackground = await sharp(originalBuffer)
        .blur(8)
        .png()
        .toBuffer();
      
      // Apply mask to get the area to remove
      const areaToRemove = await sharp(originalBuffer)
        .composite([{
          input: pngMask,
          blend: 'dest-in' // Keep only the segmented area
        }])
        .png()
        .toBuffer();
      
      // Apply inverted mask to original to get everything except the object
      const backgroundOnly = await sharp(originalBuffer)
        .composite([{
          input: invertedMask,
          blend: 'dest-in' // Keep everything except the segmented area
        }])
        .png()
        .toBuffer();
      
      // Fill the removed area with blurred background
      const filledArea = await sharp(blurredBackground)
        .composite([{
          input: pngMask,
          blend: 'dest-in' // Apply fill only to the segmented area
        }])
        .png()
        .toBuffer();
      
      // Combine background with filled area
      const cleanImage = await sharp(backgroundOnly)
        .composite([{
          input: filledArea,
          blend: 'over'
        }])
        .png()
        .toBuffer();
      
      console.log('Object removed using precise segmentation boundaries');
      
      return {
        success: true,
        cleanImageBase64: cleanImage.toString('base64')
      };
      
    } catch (error) {
      console.error('Precise object removal error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Precise removal failed'
      };
    }
  }

  /**
   * Remove object from image using segmentation mask
   */
  private async removeObjectUsingMask(
    imageUrl: string,
    segmentationMask: number[]
  ): Promise<{ success: boolean; cleanImageBase64?: string; error?: string }> {
    try {
      // Load original image
      const originalResponse = await fetch(imageUrl);
      const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
      const { width: imgWidth, height: imgHeight } = await sharp(originalBuffer).metadata();
      
      if (!imgWidth || !imgHeight) {
        throw new Error('Could not get image dimensions');
      }
      
      // Create mask from segmentation coordinates
      const maskSvg = this.createSegmentationMaskSVG(segmentationMask, imgWidth, imgHeight);
      const maskBuffer = Buffer.from(maskSvg);
      
      // Convert SVG mask to PNG
      const pngMask = await sharp(maskBuffer)
        .resize(imgWidth, imgHeight)
        .png()
        .toBuffer();
      
      // Create inpainting mask (white = area to remove, black = keep)
      const inpaintMask = await sharp(pngMask)
        .negate() // Invert colors for inpainting
        .png()
        .toBuffer();
      
      // Simple content-aware fill by blurring surrounding area into the masked region
      const blurred = await sharp(originalBuffer)
        .blur(10)
        .png()
        .toBuffer();
      
      // Composite: use blurred version only in the masked area
      const cleanImage = await sharp(originalBuffer)
        .composite([{
          input: blurred,
          blend: 'over'
        }, {
          input: inpaintMask,
          blend: 'dest-out' // Remove the object area
        }])
        .png()
        .toBuffer();
      
      return {
        success: true,
        cleanImageBase64: cleanImage.toString('base64')
      };
      
    } catch (error) {
      console.error('Object removal error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Object removal failed'
      };
    }
  }

  /**
   * Run YOLO segmentation on generated DALL-E object to get precise boundaries
   */
  private async segmentGeneratedObject(
    generatedObjectBase64: string
  ): Promise<{ success: boolean; segmentedObjectBase64?: string; error?: string }> {
    try {
      console.log('Segmenting DALL-E generated object with YOLO...');
      
      // Use the detect-url endpoint which accepts base64 data URLs (this works reliably)
      const yoloResponse = await fetch('https://8cd7e397f05e.ngrok-free.app/detect-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          image_url: `data:image/png;base64,${generatedObjectBase64}`
        })
      });
      
      if (!yoloResponse.ok) {
        const errorText = await yoloResponse.text();
        console.error('YOLO API error response:', errorText);
        throw new Error(`YOLO API request failed: ${yoloResponse.status} - ${errorText}`);
      }
      
      const yoloResult = await yoloResponse.json();
      console.log('📊 DALL-E YOLO Analysis:');
      console.log('Raw YOLO response:', JSON.stringify(yoloResult, null, 2));
      
      // Check if we got valid detections
      // The YOLO API should return objects array, not detections
      const objects = yoloResult.objects || yoloResult.detections || [];
      console.log(`YOLO detected ${objects.length} objects in generated DALL-E image`);
      
      if (!objects || objects.length === 0) {
        console.log('❌ YOLO found NO objects in DALL-E image');
        console.log('This means DALL-E generated an image without detectable objects');
        console.log('Falling back to full DALL-E image');
        
        // Return failure so caller can handle fallback
        return {
          success: false,
          error: 'No objects detected in DALL-E generated image'
        };
      }
      
      // Take the highest confidence detection
      const detection = objects.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0];
      console.log(`Best detection: ${detection.name || detection.class_name} (confidence: ${detection.confidence})`);
      
      // Get the refined path which contains the curved boundaries
      const segmentationData = detection.refinedPath || detection.segmentation || detection.mask;
      if (!segmentationData) {
        throw new Error('No segmentation data available for detected object');
      }
      
      // Extract the object using its segmentation mask
      const tempImageUrl = `data:image/png;base64,${generatedObjectBase64}`;
      const segmentedResult = await this.extractObjectUsingSegmentation(
        tempImageUrl,
        segmentationData
      );
      
      if (segmentedResult.success) {
        console.log('✅ Successfully extracted CURVED object from DALL-E generation using YOLO segmentation');
      }
      
      return {
        success: segmentedResult.success,
        segmentedObjectBase64: segmentedResult.croppedImageBase64 || '',
        error: segmentedResult.error
      };
      
    } catch (error) {
      console.error('YOLO segmentation on generated object failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'YOLO segmentation failed'
      };
    }
  }

  /**
   * Extract object from image using segmentation path (SVG path string)
   */
  private async extractObjectUsingSegmentation(
    imageUrl: string,
    segmentationPath: string
  ): Promise<{ success: boolean; croppedImageBase64?: string; error?: string }> {
    try {
      // Load image
      let imageBuffer: Buffer;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const response = await fetch(imageUrl);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      }
      
      const { width, height } = await sharp(imageBuffer).metadata();
      
      if (!width || !height) {
        throw new Error('Could not get image dimensions');
      }
      
      console.log(`Creating curved mask from segmentation path: ${segmentationPath.substring(0, 50)}...`);

      // Create SVG mask from the refined path (curved boundaries)
      const maskSvg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <path d="${segmentationPath}" fill="white" fill-rule="evenodd"/>
        </svg>
      `;
      
      console.log('Generated SVG mask for curved extraction');
      
      // Convert SVG mask to PNG
      const maskBuffer = Buffer.from(maskSvg);
      const mask = await sharp(maskBuffer).png().toBuffer();

      // Apply curved mask to extract only the curved object shape
      const result = await sharp(imageBuffer)
        .composite([{
          input: mask,
          blend: 'dest-in' // Keep only pixels where mask is white
        }])
        .png()
        .toBuffer();

      console.log('✅ Successfully extracted curved object using YOLO segmentation path');

      return {
        success: true,
        croppedImageBase64: result.toString('base64')
      };
      
    } catch (error) {
      console.error('Object extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Object extraction failed'
      };
    }
  }

  /**
   * Create SVG mask from segmentation coordinates
   */
  private createSegmentationMaskSVG(segmentationCoords: number[], width: number, height: number): string {
    const points = [];
    for (let i = 0; i < segmentationCoords.length; i += 2) {
      points.push(`${segmentationCoords[i]},${segmentationCoords[i + 1]}`);
    }
    
    const pathData = `M${points.join(' L')} Z`;
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathData}" fill="white" stroke="none"/>
    </svg>`;
  }
}

export const grokImageService = new GrokImageService();