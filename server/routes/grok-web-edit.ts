import express from "express";
import { GrokWebAutomation } from "../grok-web-automation";

const router = express.Router();

/**
 * Grok Web Automation Image Editing
 * Uses Puppeteer to automate grok.com for actual image editing
 */
router.post('/web-edit', async (req, res) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing imageUrl or prompt'
      });
    }

    console.log('🔄 Starting Grok web automation for image editing...');
    console.log('Image URL:', imageUrl);
    console.log('Prompt:', prompt);

    const webAutomation = new GrokWebAutomation();
    const result = await webAutomation.editImageViaWebInterface(imageUrl, prompt);

    if (result.success) {
      console.log('✅ Grok web automation successful!');
      res.json({
        success: true,
        editedImageUrl: result.editedImageUrl,
        method: 'grok-web-automation',
        originalPrompt: prompt,
        message: 'Image edited using Grok web interface automation'
      });
    } else {
      console.log('❌ Grok web automation failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        method: 'grok-web-automation'
      });
    }

  } catch (error) {
    console.error('Grok web edit error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'grok-web-automation'
    });
  }
});

export default router;