const getServerUrl = () => {
      const isProd = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;
      return isProd
            ? 'http://localhost:8080'
            : 'http://localhost:8080';
};
async function transcribeAudio(base64Audio, mimeType, apiKey, userLanguage = 'en', settings = {}) {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                  base64Audio,
                  mimeType,
                  userLanguage,
                  settings
            })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
            throw new Error(result.error || `HTTP ${response.status}: Transcription failed`);
      }
      return result.data;
}
async function analyzeImage(base64Image, mimeType, apiKey, customPrompt = null, metadata = null, userLanguage = 'en', settings = {}) {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                  base64Image,
                  mimeType,
                  customPrompt,
                  metadata,
                  userLanguage,
                  settings
            })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
            throw new Error(result.error || `HTTP ${response.status}: Image analysis failed`);
      }
      return result.data;
}
async function chatWithSession(context, history, userMessage, apiKey, settings = {}) {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                  context,
                  history,
                  message: userMessage,
                  settings
            })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
            throw new Error(result.error || `HTTP ${response.status}: Chat failed`);
      }
      return result.data;
}
async function getMetrics() {
      const serverUrl = getServerUrl();
      try {
            const response = await fetch(`${serverUrl}/api/metrics`);
            const result = await response.json();
            return result;
      } catch (error) {
            return {
                  latency: 0,
                  tokensUsed: 0,
                  tokensTotal: 1000000,
                  mcpConnected: false,
                  lastUpdated: Date.now()
            };
      }
}
module.exports = {
      transcribeAudio,
      analyzeImage,
      chatWithSession,
      getMetrics
};
