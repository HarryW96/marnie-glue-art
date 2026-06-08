// server/routes/enquiries.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { sendEnquiryNotification } = require('../lib/email');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, email, subject = 'General', message, work_id = null } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email, and message are required' });
    }
    const id = uuidv4();
    db.prepare(`INSERT INTO enquiries (id, name, email, subject, message, work_id) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, name, email, subject, message, work_id || null);

    const work_title = work_id
      ? db.prepare('SELECT title FROM works WHERE id = ?').get(work_id)?.title
      : null;
    sendEnquiryNotification({ name, email, subject, message, work_title });

    res.status(201).json({ success: true, message: 'Enquiry received. Thank you.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save enquiry' });
  }
});

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const enquiries = db.prepare(`
    SELECT e.*, w.title as work_title
    FROM enquiries e
    LEFT JOIN works w ON e.work_id = w.id
    ORDER BY e.created_at DESC
  `).all();
  res.json(enquiries.map(e => ({ ...e, read: !!e.read })));
});

router.patch('/:id/read', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare(`UPDATE enquiries SET read = 1 WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM enquiries WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
