import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

/**
 * Grok-to-DALL-E Fallback for Image Editing
 * Since Grok doesn't have direct image editing API, use Grok for analysis + DALL-E for generation
 */
router.post('/smart-edit', async (req, res) => {
  try {
    const { imageUrl, prompt, fallbackToDalle = false } = req.body;
    
    if (!imageUrl || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl and prompt are required'
      });
    }

    console.log('🤖 Using Grok analysis + DALL-E generation approach...');
    
    let enhancedPrompt = `A realistic interior room photo showing ${prompt}`;
    
    // Step 1: Try Grok to analyze the image and enhance the prompt
    try {
      const grokClient = new OpenAI({ 
        baseURL: "https://api.x.ai/v1", 
        apiKey: process.env.XAI_API_KEY 
      });

      console.log('🔍 Analyzing image with Grok...');
      const analysisResponse = await grokClient.chat.completions.create({
        model: "grok-2-vision-1212",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this room image and enhance the following editing request: "${prompt}". 
                
                Provide a detailed prompt for DALL-E that would create a realistic modified version of this room. 
                Focus on maintaining the room's style, lighting, and perspective while applying the requested changes.
                
                Format your response as a detailed DALL-E prompt that starts with "A realistic interior room photo showing..."`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300
      });

      enhancedPrompt = analysisResponse.choices[0].message.content;
      console.log('✅ Grok analysis complete, enhanced prompt created');
    } catch (grokError: any) {
      console.log('⚠️ Grok analysis failed (likely no credits), using basic prompt enhancement...');
      if (grokError.status === 403 && grokError.error?.includes('credits')) {
        enhancedPrompt = `A realistic interior room photo showing ${prompt}, maintaining the original room style, lighting, and perspective. High quality interior design photography.`;
      } else {
        throw grokError; // Re-throw if it's not a credits issue
      }
    }

    // Step 2: Use DALL-E to generate the modified image
    const dalleClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log('🎨 Generating modified image with DALL-E...');
    const imageResponse = await dalleClient.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt || `A realistic interior room photo showing ${prompt}`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const editedImageUrl = imageResponse.data[0].url;
    console.log('✅ Image generation complete!');

    res.json({
      success: true,
      editedImageUrl,
      method: 'grok-analysis + dalle-generation',
      originalPrompt: prompt,
      enhancedPrompt: enhancedPrompt,
      message: 'Image edited using AI intelligence with DALL-E generation'
    });

  } catch (error) {
    console.error('❌ Grok+DALL-E fallback failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'grok-dalle-fallback'
    });
  }
});

export { router as grokDalleFallbackRouter };