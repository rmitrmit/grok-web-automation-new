import express from 'express';
import { GrokImageEditingService } from '../grok-web-automation';

const router = express.Router();
const grokService = new GrokImageEditingService();

/**
 * Automated Grok Image Editing Endpoint
 * POST /api/grok/automate-edit
 */
router.post('/automate-edit', async (req, res) => {
  try {
    const { 
      imageUrl, 
      imageBase64, 
      prompt, 
      method = 'auto',
      webCredentials 
    } = req.body;

    console.log('🤖 Starting automated Grok image editing...');
    console.log(`Method: ${method}, Prompt: ${prompt}`);

    // Convert image URL to base64 if needed
    let finalImageBase64 = imageBase64;
    if (imageUrl && !imageBase64) {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      finalImageBase64 = Buffer.from(buffer).toString('base64');
    }

    if (!finalImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Either imageUrl or imageBase64 is required'
      });
    }

    // Execute automated editing
    const result = await grokService.editImage(finalImageBase64, prompt, {
      preferredMethod: method,
      webCredentials
    });

    if (result.success) {
      console.log(`✅ Grok automated editing completed via ${result.method}`);
      res.json({
        success: true,
        editedImageUrl: result.editedImageUrl,
        method: result.method,
        prompt,
        processingTime: Date.now()
      });
    } else {
      console.error('❌ Grok automated editing failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Grok automation endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test Grok Automation Status
 * GET /api/grok/automation-status
 */
router.get('/automation-status', async (req, res) => {
  res.json({
    success: true,
    availableMethods: ['api', 'web', 'auto'],
    apiAvailable: !!process.env.XAI_API_KEY,
    webAutomationAvailable: true, // Would check Puppeteer installation
    description: 'Automated Grok image editing service with API and web automation fallback'
  });
});

export { router as grokAutomationRouter };