// server/index.js

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const worksRouter      = require('./routes/works');
const authRouter       = require('./routes/auth');
const settingsRouter   = require('./routes/settings');
const enquiriesRouter  = require('./routes/enquiries');
const categoriesRouter = require('./routes/categories');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL  // set this to your Vercel URL in production
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/works',      worksRouter);
app.use('/api/auth',       authRouter);
app.use('/api/settings',   settingsRouter);
app.use('/api/enquiries',  enquiriesRouter);
app.use('/api/categories', categoriesRouter);

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

// ── Serve frontend (production) ──────────────────────────────────────────────
// In development, serve client/ statically for convenience.
// In production on Railway, you can either:
//   a) serve the client/ folder from the same Express server (done here), OR
//   b) deploy client/ to Vercel separately and set FRONTEND_URL env var.

if (process.env.NODE_ENV !== 'production' || process.env.SERVE_STATIC === 'true') {
  const clientDir = path.join(__dirname, '../client');
  app.use(express.static(clientDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Studio API running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
