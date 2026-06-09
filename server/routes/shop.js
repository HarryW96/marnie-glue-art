// server/routes/shop.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { upload, uploadToCloudinary, cloudinary } = require('../middleware/cloudinary');

const router = express.Router();

function withImages(item) {
  const db = getDb();
  const images = db.prepare(
    `SELECT * FROM shop_images WHERE item_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(item.id);
  return { ...item, available: !!item.available, images };
}

// ── Public ────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDb();
  const items = db.prepare(`SELECT * FROM shop_items ORDER BY sort_order ASC, created_at DESC`).all();
  res.json(items.map(withImages));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(withImages(item));
});

// ── Admin ─────────────────────────────────────────────────────────────────────

router.post('/', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const db = getDb();
    const { title, price = 'On enquiry', description = '', dimensions = '',
            edition = '', available = '1', shopify_embed = '' } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const id = uuidv4();
    const maxRow = db.prepare(`SELECT MAX(sort_order) as m FROM shop_items`).get();
    const sort_order = (maxRow?.m || 0) + 1;
    const avail = (available === '1' || available === 'true') ? 1 : 0;
    db.prepare(`
      INSERT INTO shop_items (id, title, price, description, dimensions, edition, available, shopify_embed, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, price, description, dimensions, edition, avail, shopify_embed, sort_order);
    if (req.files && req.files.length > 0) {
      const insertImg = db.prepare(
        `INSERT INTO shop_images (id, item_id, image_url, image_id, sort_order) VALUES (?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < req.files.length; i++) {
        const { url, public_id } = await uploadToCloudinary(req.files[i].buffer);
        insertImg.run(uuidv4(), id, url, public_id, i);
      }
    }
    res.status(201).json(withImages(db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// batch/reorder MUST be before /:id so 'batch' isn't treated as an id
router.patch('/batch/reorder', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const update = db.prepare(`UPDATE shop_items SET sort_order = ? WHERE id = ?`);
    order.forEach(item => update.run(item.sort_order, item.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

router.patch('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const allowed = ['title', 'price', 'description', 'dimensions', 'edition',
                     'available', 'shopify_embed', 'sort_order'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.available !== undefined) {
      updates.available = (updates.available === '1' || updates.available === 'true' || updates.available === true) ? 1 : 0;
    }
    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE shop_items SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
        .run(...Object.values(updates), req.params.id);
    }
    res.json(withImages(db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.post('/:id/images', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images' });
    const maxOrder = db.prepare(`SELECT MAX(sort_order) as m FROM shop_images WHERE item_id = ?`).get(req.params.id);
    const insertImg = db.prepare(
      `INSERT INTO shop_images (id, item_id, image_url, image_id, sort_order) VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < req.files.length; i++) {
      const { url, public_id } = await uploadToCloudinary(req.files[i].buffer);
      insertImg.run(uuidv4(), req.params.id, url, public_id, (maxOrder?.m || 0) + i + 1);
    }
    db.prepare(`UPDATE shop_items SET updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.status(201).json(withImages(db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add images' });
  }
});

router.delete('/:id/images/:imageId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const img = db.prepare(`SELECT * FROM shop_images WHERE id = ? AND item_id = ?`)
      .get(req.params.imageId, req.params.id);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    if (img.image_id) try { await cloudinary.uploader.destroy(img.image_id); } catch (_) {}
    db.prepare(`DELETE FROM shop_images WHERE id = ?`).run(req.params.imageId);
    res.json(withImages(db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

router.patch('/:id/images/reorder', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const update = db.prepare(`UPDATE shop_images SET sort_order = ? WHERE id = ? AND item_id = ?`);
    order.forEach(o => update.run(o.sort_order, o.id, req.params.id));
    res.json(withImages(db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder images' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare(`SELECT * FROM shop_items WHERE id = ?`).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const images = db.prepare(`SELECT * FROM shop_images WHERE item_id = ?`).all(req.params.id);
    for (const img of images) {
      if (img.image_id) try { await cloudinary.uploader.destroy(img.image_id); } catch (_) {}
    }
    db.prepare(`DELETE FROM shop_items WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
