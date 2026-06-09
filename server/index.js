// server/index.js

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const worksRouter      = require('./routes/works');
const authRouter       = require('./routes/auth');
const settingsRouter   = require('./routes/settings');
const enquiriesRouter  = require('./routes/enquiries');
const categoriesRouter = require('./routes/categories');
const shopRouter       = require('./routes/shop');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Rate limiters ────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes.' },
});

const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 submissions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiries submitted from this address.' },
});

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({
  // Allow inline scripts on the admin pages (needed for vanilla JS)
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL  // set this to your Vercel URL in production
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/works',            worksRouter);
app.use('/api/auth/login',       loginLimiter);
app.use('/api/auth',             authRouter);
app.use('/api/settings',         settingsRouter);
app.use('/api/enquiries',        enquiryLimiter);
app.use('/api/enquiries',        enquiriesRouter);
app.use('/api/categories',       categoriesRouter);
app.use('/api/shop',             shopRouter);

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
