// server/routes/auth.js

const express = require('express');
const { checkPassword, signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  try {
    if (!checkPassword(password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const token = signToken({ role: 'admin' });
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

// GET /api/auth/check — verify token is still valid
router.get('/check', requireAuth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
