import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

/**
 * Test endpoint to verify Grok functionality with a simple text generation
 * This helps debug if the issue is with the API key or the image editing specifically
 */
router.post('/test-grok-connection', async (req, res) => {
  try {
    console.log('🧪 Testing Grok API connection...');
    
    // Test basic Grok API connection with text generation
    const grokClient = new OpenAI({ 
      baseURL: "https://api.x.ai/v1", 
      apiKey: process.env.XAI_API_KEY 
    });

    const response = await grokClient.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "user",
          content: "Hello! Just testing the connection. Please respond with 'Connection successful!'"
        }
      ],
      max_tokens: 20
    });

    console.log('✅ Grok API connection successful!');
    res.json({
      success: true,
      message: 'Grok API connection is working',
      response: response.choices[0].message.content,
      availableModels: ['grok-2-1212', 'grok-2-vision-1212', 'grok-beta', 'grok-vision-beta']
    });

  } catch (error) {
    console.error('❌ Grok API connection failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Check if XAI_API_KEY is set correctly or if there are API usage limits'
    });
  }
});

/**
 * Test Grok vision capabilities (image analysis, not editing)
 */
router.post('/test-grok-vision', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl is required'
      });
    }

    console.log('🔍 Testing Grok vision capabilities...');
    
    const grokClient = new OpenAI({ 
      baseURL: "https://api.x.ai/v1", 
      apiKey: process.env.XAI_API_KEY 
    });

    const response = await grokClient.chat.completions.create({
      model: "grok-2-vision-1212",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe what you see in this image in detail."
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
      max_tokens: 200
    });

    console.log('✅ Grok vision test successful!');
    res.json({
      success: true,
      message: 'Grok can analyze images successfully',
      analysis: response.choices[0].message.content,
      note: 'Grok can see and analyze images, but direct image editing API is not available yet'
    });

  } catch (error) {
    console.error('❌ Grok vision test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as grokTestRouter };