const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();
const tokens = new Map();
const getGoogleClient = () => {
      const redirectUri = process.env.NODE_ENV === 'production'
            ? 'http://localhost:8080/auth/google/callback'
            : 'http://localhost:8080/auth/google/callback';
      return new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
      );
};
router.get('/google', (req, res) => {
      const client = getGoogleClient();
      const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar.events'],
            prompt: 'consent'
      });
      res.redirect(authUrl);
});
router.get('/google/callback', async (req, res) => {
      const { code } = req.query;
      if (!code) {
            return res.status(400).send('Missing authorization code');
      }
      try {
            const client = getGoogleClient();
            const { tokens: tokenData } = await client.getToken(code);
            const tokenId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            tokens.set(tokenId, { provider: 'google_calendar', ...tokenData });
            setTimeout(() => tokens.delete(tokenId), 60000);
            const baseUrl = process.env.NODE_ENV === 'production'
                  ? 'http://localhost:8080'
                  : 'http://localhost:8080';
            const callbackUrl = `${baseUrl}/auth/success?provider=google_calendar&token_id=${tokenId}`;
            res.redirect(callbackUrl);
      } catch (error) {
            console.error('Google OAuth error:', error);
            res.status(500).send('OAuth failed: ' + error.message);
      }
});
router.get('/google/status', (req, res) => {
      res.json({
            configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      });
});
router.get('/notion', (req, res) => {
      const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(process.env.NOTION_REDIRECT_URI)}`;
      res.redirect(authUrl);
});
router.get('/notion/callback', async (req, res) => {
      const { code } = req.query;
      if (!code) {
            return res.status(400).send('Missing authorization code');
      }
      try {
            const response = await fetch('https://api.notion.com/v1/oauth/token', {
                  method: 'POST',
                  headers: {
                        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
                        'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: process.env.NOTION_REDIRECT_URI
                  })
            });
            const tokenData = await response.json();
            if (!response.ok) {
                  throw new Error(tokenData.error || 'Token exchange failed');
            }
            const tokenId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            tokens.set(tokenId, { provider: 'notion', ...tokenData });
            setTimeout(() => tokens.delete(tokenId), 60000);
            const callbackUrl = `http://localhost:8080/auth/success?provider=notion&token_id=${tokenId}`;
            res.redirect(callbackUrl);
      } catch (error) {
            console.error('Notion OAuth error:', error);
            res.status(500).send('OAuth failed: ' + error.message);
      }
});
router.get('/notion/status', (req, res) => {
      res.json({
            configured: !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET)
      });
});
router.get('/token/:id', (req, res) => {
      const token = tokens.get(req.params.id);
      if (!token) {
            return res.status(404).json({ error: 'Token not found or expired' });
      }
      tokens.delete(req.params.id);
      res.json(token);
});
router.get('/status', (req, res) => {
      res.json({
            google_calendar: { configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
            notion: { configured: !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET) }
      });
});
router.get('/success', (req, res) => {
      const { provider, token_id } = req.query;
      res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                  <title>Authentication Successful</title>
                  <style>
                        body { 
                              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                              display: flex; justify-content: center; align-items: center;
                              height: 100vh; margin: 0; background: #1a1a1a; color: white;
                        }
                        .container { text-align: center; }
                        h1 { color: #10b981; }
                  </style>
            </head>
            <body>
                  <div class="container">
                        <h1>✓ Connected!</h1>
                        <p>You can close this window now.</p>
                  </div>
            </body>
            </html>
      `);
});
module.exports = router;
