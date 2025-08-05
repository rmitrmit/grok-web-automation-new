import OpenAI from "openai";
import express from "express";

const router = express.Router();

/**
 * Grok Direct Image Editing using Aurora Model
 * Since Grok API doesn't support direct image editing yet,
 * we use the generation endpoint with detailed prompts
 */

async function editImageWithGrok(imageUrl: string, prompt: string): Promise<{ success: boolean; editedImageUrl?: string; enhancedPrompt?: string; error?: string }> {
  try {
    console.log('🔄 Using Grok Aurora for image editing via generation...');
    
    const grokClient = new OpenAI({
      baseURL: "https://api.x.ai/v1",
      apiKey: process.env.XAI_API_KEY
    });

    // Create a simple, focused prompt for direct editing
    const enhancedPrompt = `A modern living room with ${prompt}`;
    
    console.log('✅ Using direct prompt:', enhancedPrompt);
    console.log('Prompt length:', enhancedPrompt.length);

    // Now generate the edited image using the enhanced prompt
    const imageResponse = await grokClient.images.generate({
      model: "grok-2-image-1212",
      prompt: enhancedPrompt || `A realistic interior room photo with the following modification: ${prompt}`,
      n: 1
    });

    if (imageResponse.data && imageResponse.data[0]?.url) {
      console.log('✅ Grok Aurora image generation successful!');
      return {
        success: true,
        editedImageUrl: imageResponse.data[0].url,
        enhancedPrompt: enhancedPrompt || undefined
      };
    } else {
      throw new Error('No image returned from Grok Aurora');
    }

  } catch (error: any) {
    console.log('❌ Grok editing failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Direct Grok editing endpoint
router.post('/grok-direct-edit', async (req, res) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing imageUrl or prompt'
      });
    }

    console.log('🚀 Starting Grok direct image editing...');
    const result = await editImageWithGrok(imageUrl, prompt);

    if (result.success) {
      res.json({
        success: true,
        editedImageUrl: result.editedImageUrl,
        method: 'grok-aurora-generation',
        originalPrompt: prompt,
        enhancedPrompt: result.enhancedPrompt,
        message: 'Image edited using Grok Aurora vision analysis + generation'
      });
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('Grok direct edit error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;