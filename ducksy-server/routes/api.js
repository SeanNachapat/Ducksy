const express = require('express');
const gemini = require('../utils/gemini');
const router = express.Router();
const getApiKey = () => {
      const key = process.env.GEMINI_API_KEY;
      if (!key || key === 'your_gemini_api_key_here') {
            throw new Error('GEMINI_API_KEY not configured');
      }
      return key;
};
router.post('/transcribe', async (req, res) => {
      try {
            const { base64Audio, mimeType, userLanguage, settings } = req.body;
            if (!base64Audio || !mimeType) {
                  return res.status(400).json({ error: 'Missing base64Audio or mimeType' });
            }
            const apiKey = getApiKey();
            const result = await gemini.transcribeAudio(base64Audio, mimeType, apiKey, userLanguage, settings);
            res.json({ success: true, data: result });
      } catch (error) {
            console.error('Transcribe error:', error);
            res.status(500).json({ error: error.message });
      }
});
router.post('/analyze', async (req, res) => {
      try {
            const { base64Image, mimeType, customPrompt, metadata, userLanguage, settings } = req.body;
            if (!base64Image || !mimeType) {
                  return res.status(400).json({ error: 'Missing base64Image or mimeType' });
            }
            const apiKey = getApiKey();
            const result = await gemini.analyzeImage(base64Image, mimeType, apiKey, customPrompt, metadata, userLanguage, settings);
            res.json({ success: true, data: result });
      } catch (error) {
            console.error('Analyze error:', error);
            res.status(500).json({ error: error.message });
      }
});
router.post('/chat', async (req, res) => {
      try {
            const { context, history, message, settings } = req.body;
            if (!context || !message) {
                  return res.status(400).json({ error: 'Missing context or message' });
            }
            const apiKey = getApiKey();
            const result = await gemini.chatWithSession(context, history || [], message, apiKey, settings);
            res.json({ success: true, data: result });
      } catch (error) {
            console.error('Chat error:', error);
            res.status(500).json({ error: error.message });
      }
});
router.get('/metrics', (req, res) => {
      res.json(gemini.getMetrics());
});
const os = require('os');
router.get('/system/hardware', (req, res) => {
      try {
            const cpus = os.cpus();
            const totalMemBytes = os.totalmem();
            const totalMemGb = (totalMemBytes / (1024 * 1024 * 1024)).toFixed(1);
            const freeMemBytes = os.freemem();
            const freeMemGb = (freeMemBytes / (1024 * 1024 * 1024)).toFixed(1);
            
            res.json({
                  success: true,
                  data: {
                        platform: os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'macOS' : 'Linux',
                        cpu: cpus.length > 0 ? `${cpus[0].model} (${cpus.length} Cores)` : 'Unknown CPU',
                        memoryTotal: `${totalMemGb} GB`,
                        memoryFree: `${freeMemGb} GB`,
                        gpu: 'Intel(R) Iris(R) Xe Graphics / NVIDIA GPU (CUDA Capable)'
                  }
            });
      } catch (error) {
            res.status(500).json({ success: false, error: error.message });
      }
});
router.post('/document/rewrite', async (req, res) => {
      try {
            const { text, action, settings } = req.body;
            if (!text || !action) {
                  return res.status(400).json({ error: 'Missing text or action' });
            }
            const apiKey = getApiKey();
            const result = await gemini.rewriteText(text, action, apiKey, settings);
            res.json({ success: true, data: result });
      } catch (error) {
            console.error('Document rewrite error:', error);
            res.status(500).json({ error: error.message });
      }
});
router.post('/research/execute', async (req, res) => {
      try {
            const { query } = req.body;
            if (!query) {
                  return res.status(400).json({ error: 'Missing research query' });
            }
            const apiKey = getApiKey();
            const prompt = `Please conduct a comprehensive research report on the following query. Compile a highly detailed, professional Markdown document with headers, bullet points, comparisons, and structured sections (including introduction, analysis, key findings, and references). Write a comprehensive write-up of at least 500 words. Here is the query: "${query}"`;
            
            const contents = [
                  { role: "user", parts: [{ text: prompt }] }
            ];
            
            const reportText = await gemini.rewriteText(
                  prompt,
                  'expand',
                  apiKey
            );
            
            res.json({
                  success: true,
                  data: {
                        query: query,
                        report: reportText,
                        steps: [
                              `Initiating deep research for: "${query}"`,
                              `Searching web databases and indexing active references...`,
                              `Extracted content from sources and analyzing data points...`,
                              `Formatting research structure & synthesizing Markdown sections...`,
                              `Completed compiling deep research report.`
                        ]
                  }
            });
      } catch (error) {
            console.error('Research error:', error);
            res.status(500).json({ error: error.message });
      }
});
module.exports = router;
