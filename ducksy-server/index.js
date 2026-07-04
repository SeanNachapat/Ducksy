const path = require('path');
// Load env from the repo root's .env.local (one level up from ducksy-server/)
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const calendarRoutes = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/calendar', calendarRoutes);

app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
      console.log(`Ducksy Server running on http://localhost:${PORT}`);
});
