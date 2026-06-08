// server/routes/works.js
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { upload, processUpload, cloudinary, uploadToCloudinary } = require('../middleware/cloudinary');

const router = express.Router();

// Attach images array to a work row
function withImages(work) {
  const db = getDb();
  const images = db.prepare(
    `SELECT * FROM work_images WHERE work_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(work.id);
  return { ...work, available: !!work.available, images };
}

// ── Public ────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDb();
  const { category } = req.query;
  const works = category && category !== 'all'
    ? db.prepare(`SELECT * FROM works WHERE category = ? ORDER BY sort_order ASC, created_at DESC`).all(category)
    : db.prepare(`SELECT * FROM works ORDER BY sort_order ASC, created_at DESC`).all();
  res.json(works.map(withImages));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const work = db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id);
  if (!work) return res.status(404).json({ error: 'Work not found' });
  res.json(withImages(work));
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// POST /api/works — create with up to 10 images
router.post('/', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const db = getDb();
    const { title, year, category, medium = '', dimensions = '',
            description = '', price = 'On enquiry', available = '1',
            colour = '#C4956A' } = req.body;

    if (!title || !year || !category) {
      return res.status(400).json({ error: 'title, year, and category are required' });
    }

    const id = uuidv4();
    const maxRow = db.prepare(`SELECT MAX(sort_order) as m FROM works`).get();
    const sort_order = (maxRow?.m || 0) + 1;
    const avail = (available === '1' || available === 'true') ? 1 : 0;

    db.prepare(`
      INSERT INTO works (id, title, year, category, medium, dimensions, description,
                         price, available, colour, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, year, category, medium, dimensions, description,
           price, avail, colour, sort_order);

    // Upload each image to Cloudinary and store in work_images
    if (req.files && req.files.length > 0) {
      
      const insertImg = db.prepare(
        `INSERT INTO work_images (id, work_id, image_url, image_id, sort_order) VALUES (?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < req.files.length; i++) {
        const { url, public_id } = await uploadToCloudinary(req.files[i].buffer);
        insertImg.run(uuidv4(), id, url, public_id, i);
      }
    }

    res.status(201).json(withImages(db.prepare(`SELECT * FROM works WHERE id = ?`).get(id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create work' });
  }
});

// PATCH /api/works/:id — update metadata only
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const work = db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id);
    if (!work) return res.status(404).json({ error: 'Work not found' });

    const allowed = ['title','year','category','medium','dimensions','description',
                     'price','available','colour','sort_order'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.available !== undefined) {
      updates.available = (updates.available === '1' || updates.available === 'true' || updates.available === true) ? 1 : 0;
    }
    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE works SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
        .run(...Object.values(updates), req.params.id);
    }
    res.json(withImages(db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update work' });
  }
});

// POST /api/works/:id/images — add more images to existing work
router.post('/:id/images', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const db = getDb();
    const work = db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id);
    if (!work) return res.status(404).json({ error: 'Work not found' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images provided' });

    
    const maxOrder = db.prepare(`SELECT MAX(sort_order) as m FROM work_images WHERE work_id = ?`).get(req.params.id);
    const insertImg = db.prepare(
      `INSERT INTO work_images (id, work_id, image_url, image_id, sort_order) VALUES (?, ?, ?, ?, ?)`
    );
    const uploaded = [];
    for (let i = 0; i < req.files.length; i++) {
      const { url, public_id } = await uploadToCloudinary(req.files[i].buffer);
      const sort_order = (maxOrder?.m || 0) + i + 1;
      const imgId = uuidv4();
      insertImg.run(imgId, req.params.id, url, public_id, sort_order);
      uploaded.push({ id: imgId, image_url: url, sort_order });
    }

    db.prepare(`UPDATE works SET updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.status(201).json(withImages(db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add images' });
  }
});

// DELETE /api/works/:id/images/:imageId — remove a single image
router.delete('/:id/images/:imageId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const img = db.prepare(`SELECT * FROM work_images WHERE id = ? AND work_id = ?`)
      .get(req.params.imageId, req.params.id);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    if (img.image_id) {
      try { await cloudinary.uploader.destroy(img.image_id); } catch (_) {}
    }
    db.prepare(`DELETE FROM work_images WHERE id = ?`).run(req.params.imageId);
    db.prepare(`UPDATE works SET updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json(withImages(db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// PATCH /api/works/:id/images/reorder — update image sort order
router.patch('/:id/images/reorder', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { order } = req.body; // [{ id, sort_order }, ...]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const update = db.prepare(`UPDATE work_images SET sort_order = ? WHERE id = ? AND work_id = ?`);
    order.forEach(item => update.run(item.sort_order, item.id, req.params.id));
    res.json(withImages(db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder images' });
  }
});

// DELETE /api/works/:id — delete work + all its images from Cloudinary
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const work = db.prepare(`SELECT * FROM works WHERE id = ?`).get(req.params.id);
    if (!work) return res.status(404).json({ error: 'Work not found' });

    const images = db.prepare(`SELECT * FROM work_images WHERE work_id = ?`).all(req.params.id);
    for (const img of images) {
      if (img.image_id) try { await cloudinary.uploader.destroy(img.image_id); } catch (_) {}
    }
    // CASCADE delete removes work_images rows automatically
    db.prepare(`DELETE FROM works WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete work' });
  }
});

// PATCH /api/works/batch/reorder
router.patch('/batch/reorder', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const update = db.prepare(`UPDATE works SET sort_order = ? WHERE id = ?`);
    order.forEach(item => update.run(item.sort_order, item.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

module.exports = router;
