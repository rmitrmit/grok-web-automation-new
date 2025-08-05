import express from 'express';
import { grokImageService } from '../grok-image-service';

const router = express.Router();

/**
 * Crop object from image using segmentation mask
 */
router.post('/crop-object', async (req, res) => {
  try {
    const { imageUrl, segmentationMask } = req.body;
    
    if (!imageUrl || !segmentationMask) {
      return res.status(400).json({ 
        success: false, 
        error: 'imageUrl and segmentationMask are required' 
      });
    }
    
    const result = await grokImageService.cropObjectFromImage({
      imageUrl,
      segmentationMask
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Crop object error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate replacement object using Grok
 */
router.post('/generate-replacement', async (req, res) => {
  try {
    const { croppedObjectImage, replacementPrompt, originalImageUrl } = req.body;
    
    if (!croppedObjectImage || !replacementPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'croppedObjectImage and replacementPrompt are required' 
      });
    }
    
    // This endpoint is deprecated - use scene-based replacement instead
    const result = {
      success: false,
      error: 'This endpoint is deprecated. Use /replace-object-scene instead.'
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('Generate replacement error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * NEW: Replace object using scene-based difference detection
 */
router.post('/replace-object-scene', async (req, res) => {
  try {
    const { imageUrl, segmentationMask, replacementPrompt, objectName } = req.body;
    
    if (!imageUrl || !segmentationMask || !replacementPrompt || !objectName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: imageUrl, segmentationMask, replacementPrompt, objectName'
      });
    }
    
    console.log('🔄 Starting NEW scene-based object replacement...');
    console.log('Image URL:', imageUrl);
    console.log('Object name:', objectName);
    console.log('Segmentation mask length:', segmentationMask.length);
    console.log('Replacement prompt:', replacementPrompt);
    
    // Use the new scene-based replacement workflow
    const result = await grokImageService.replaceObjectWithSceneDiff(
      imageUrl,
      segmentationMask,
      replacementPrompt,
      objectName
    );
    
    if (result.success) {
      console.log('✅ NEW scene-based replacement completed successfully');
      res.json({
        success: true,
        finalImageBase64: result.finalImageBase64,
        originalScene: result.originalScene,
        generatedScene: result.generatedScene,
        extractedDifferences: result.extractedDifferences,
        revisedPrompt: result.revisedPrompt
      });
    } else {
      console.error('❌ NEW scene-based replacement failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('Scene-based replacement API error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown server error'
    });
  }
});

/**
 * Complete object replacement workflow
 */
router.post('/replace-object', async (req, res) => {
  try {
    const { imageUrl, segmentationMask, replacementPrompt } = req.body;
    
    if (!imageUrl || !segmentationMask || !replacementPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'imageUrl, segmentationMask, and replacementPrompt are required' 
      });
    }
    
    console.log('Starting Grok-powered object replacement...');
    console.log('Replacement prompt:', replacementPrompt);
    
    const result = await grokImageService.replaceObject(
      imageUrl,
      segmentationMask,
      replacementPrompt
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Replace object error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;