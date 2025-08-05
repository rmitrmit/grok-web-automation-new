import express from "express";

const router = express.Router();

/**
 * Production-Ready Grok Deployment Status
 * Provides deployment guidance and fallback options
 */
router.post('/deployment-status', async (req, res) => {
  try {
    console.log('🔍 Checking Grok deployment readiness...');

    // Check if we're in a browser-capable environment
    let puppeteer: any;
    let browserAvailable = false;
    
    try {
      puppeteer = await import('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      await browser.close();
      browserAvailable = true;
      console.log('✅ Browser environment ready with Chromium');
    } catch (error) {
      console.log('⚠️ Browser environment not ready:', error.message);
    }

    // Check API credentials
    const apiAvailable = !!process.env.XAI_API_KEY;
    
    const deploymentOptions = {
      webAutomation: {
        available: browserAvailable,
        status: browserAvailable ? 'ready' : 'needs-chrome-dependencies',
        message: browserAvailable 
          ? 'Web automation ready for grok.com' 
          : 'Deploy to production environment with Chrome support'
      },
      apiGeneration: {
        available: apiAvailable,
        status: apiAvailable ? 'ready' : 'needs-api-key',
        message: apiAvailable 
          ? 'Grok Aurora generation ready (creates new images)' 
          : 'XAI API key needed'
      },
      recommendations: browserAvailable 
        ? ['Use web automation for actual image editing']
        : [
            'Deploy to Vercel/Netlify with Chrome layer',
            'Use Docker with chromium package',
            'Deploy to cloud environment with browser support',
            'Alternative: Use API generation as fallback'
          ]
    };

    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'development',
      browserAvailable,
      apiAvailable,
      deploymentOptions,
      productionReady: browserAvailable && apiAvailable
    });

  } catch (error) {
    console.error('Deployment status check failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    });
  }
});

/**
 * Hybrid Grok Editing with Smart Fallback
 * Tries web automation first, falls back to API generation
 */
router.post('/smart-edit', async (req, res) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing imageUrl or prompt'
      });
    }

    console.log('🤖 Starting smart Grok editing with fallback...');

    // First, try web automation (for actual editing)
    try {
      const { GrokWebAutomation } = await import('../grok-web-automation');
      const webAutomation = new GrokWebAutomation();
      const webResult = await webAutomation.editImageViaWebInterface(imageUrl, prompt);
      
      if (webResult.success) {
        return res.json({
          success: true,
          editedImageUrl: webResult.editedImageUrl,
          method: 'web-automation',
          message: 'Image edited using Grok web interface (actual editing)'
        });
      } else {
        console.log('Web automation failed, trying API fallback...');
      }
    } catch (webError) {
      console.log('Web automation not available, using API fallback...');
    }

    // Fallback to API generation (creates new image)
    try {
      const { GrokDirectAPI } = await import('../grok-web-automation');
      const directAPI = new GrokDirectAPI();
      const apiResult = await directAPI.editImageWithGrok('', prompt);
      
      if (apiResult.success) {
        return res.json({
          success: true,
          editedImageUrl: apiResult.editedImageUrl,
          method: 'api-generation-fallback',
          message: 'Generated new image using Grok Aurora (fallback method)',
          note: 'This creates a new image rather than editing the original'
        });
      }
    } catch (apiError) {
      console.log('API generation also failed:', apiError.message);
    }

    // Both methods failed
    res.status(500).json({
      success: false,
      error: 'All Grok editing methods failed. Deploy to production environment for web automation.',
      recommendation: 'Deploy to Vercel, Netlify, or Docker with Chrome dependencies'
    });

  } catch (error) {
    console.error('Smart edit error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Smart edit failed'
    });
  }
});

export default router;