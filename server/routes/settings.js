// server/routes/settings.js
const express = require('express');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../middleware/cloudinary');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT key, value FROM site_settings`).all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.patch('/', requireAuth, (req, res) => {
  const db = getDb();
  const allowed = [
    'artist_name', 'tagline', 'email', 'instagram', 'location', 'bio',
    'hero_title', 'hero_subtitle',
    'portrait_url', 'cv_exhibitions', 'cv_education',
  ];
  const upsert = db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  Object.entries(req.body).forEach(([k, v]) => {
    if (allowed.includes(k)) upsert.run(k, v);
  });
  const rows = db.prepare(`SELECT key, value FROM site_settings`).all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.post('/portrait', requireAuth, upload.single('portrait'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  try {
    const { url } = await uploadToCloudinary(req.file.buffer, 'studio-portrait');
    const db = getDb();
    db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run('portrait_url', url);
    res.json({ portrait_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Portrait upload failed' });
  }
});

module.exports = router;
