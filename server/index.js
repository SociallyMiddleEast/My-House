require('dotenv').config();
const express = require('express');
const cors = require('cors');
const requireProxyKey = require('./middleware/auth');

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true, // wide open if unset — fine for local dev only
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-proxy-key']
}));

// Health check is intentionally unauthenticated so the frontend's "Test
// connection" button can tell "wrong URL" apart from "wrong key".
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api', requireProxyKey);
app.use('/api/deye', require('./routes/deye'));
app.use('/api/tuya', require('./routes/tuya'));
app.use('/api/lg', require('./routes/lgthinq'));
app.use('/api/smartthings', require('./routes/smartthings'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Home Control proxy listening on :${port}`));
