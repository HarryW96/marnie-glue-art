// server/routes/categories.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { upload, uploadToCloudinary, cloudinary } = require('../middleware/cloudinary');

const router = express.Router();

function slugify(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseLinks(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

router.get('/', (req, res) => {
  const db = getDb();
  const cats = db.prepare(`SELECT * FROM categories ORDER BY sort_order ASC, name ASC`).all();
  res.json(cats.map(c => ({ ...c, links: parseLinks(c.links) })));
});

router.post('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { name, description = '', links = [] } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const slug = slugify(name);
    const existing = db.prepare(`SELECT id FROM categories WHERE slug = ?`).get(slug);
    if (existing) return res.status(409).json({ error: 'A category with that name already exists' });

    const id = uuidv4();
    const maxRow = db.prepare(`SELECT MAX(sort_order) as m FROM categories`).get();
    const sort_order = (maxRow?.m || 0) + 1;

    db.prepare(`INSERT INTO categories (id, name, slug, sort_order, description, links) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, name.trim(), slug, sort_order, description, JSON.stringify(links));

    const cat = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
    res.status(201).json({ ...cat, links: parseLinks(cat.links) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.patch('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const cat = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const { name, sort_order, description, links } = req.body;
    if (name !== undefined) {
      const slug = slugify(name);
      const conflict = db.prepare(`SELECT id FROM categories WHERE slug = ? AND id != ?`).get(slug, req.params.id);
      if (conflict) return res.status(409).json({ error: 'A category with that name already exists' });
      db.prepare(`UPDATE categories SET name = ?, slug = ? WHERE id = ?`).run(name.trim(), slug, req.params.id);
      db.prepare(`UPDATE works SET category = ? WHERE category = ?`).run(slug, cat.slug);
    }
    if (sort_order !== undefined) {
      db.prepare(`UPDATE categories SET sort_order = ? WHERE id = ?`).run(sort_order, req.params.id);
    }
    if (description !== undefined) {
      db.prepare(`UPDATE categories SET description = ? WHERE id = ?`).run(description, req.params.id);
    }
    if (links !== undefined) {
      db.prepare(`UPDATE categories SET links = ? WHERE id = ?`).run(JSON.stringify(links), req.params.id);
    }

    const updated = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id);
    res.json({ ...updated, links: parseLinks(updated.links) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const cat = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const workCount = db.prepare(`SELECT COUNT(*) as n FROM works WHERE category = ?`).get(cat.slug);
    if (workCount.n > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${workCount.n} work${workCount.n !== 1 ? 's' : ''} still use this category. Reassign them first.`
      });
    }

    db.prepare(`DELETE FROM categories WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ── Collection photos ─────────────────────────────────────────────────────────

router.get('/:categoryId/photos', (req, res) => {
  const db = getDb();
  const photos = db.prepare(
    `SELECT * FROM collection_images WHERE category_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(req.params.categoryId);
  res.json(photos);
});

router.post('/:categoryId/photos', requireAuth, upload.array('photos', 20), async (req, res) => {
  try {
    const db = getDb();
    const cat = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images provided' });

    const maxOrder = db.prepare(
      `SELECT MAX(sort_order) as m FROM collection_images WHERE category_id = ?`
    ).get(req.params.categoryId);
    const insert = db.prepare(
      `INSERT INTO collection_images (id, category_id, image_url, image_id, sort_order) VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < req.files.length; i++) {
      const { url, public_id } = await uploadToCloudinary(req.files[i].buffer, 'studio-collection');
      insert.run(uuidv4(), req.params.categoryId, url, public_id, (maxOrder?.m || 0) + i + 1);
    }

    const photos = db.prepare(
      `SELECT * FROM collection_images WHERE category_id = ? ORDER BY sort_order ASC, created_at ASC`
    ).all(req.params.categoryId);
    res.status(201).json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

router.delete('/:categoryId/photos/:photoId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const photo = db.prepare(
      `SELECT * FROM collection_images WHERE id = ? AND category_id = ?`
    ).get(req.params.photoId, req.params.categoryId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    if (photo.image_id) {
      try { await cloudinary.uploader.destroy(photo.image_id); } catch (_) {}
    }
    db.prepare(`DELETE FROM collection_images WHERE id = ?`).run(req.params.photoId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

router.patch('/:categoryId/photos/reorder', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const update = db.prepare(
      `UPDATE collection_images SET sort_order = ? WHERE id = ? AND category_id = ?`
    );
    order.forEach(item => update.run(item.sort_order, item.id, req.params.categoryId));
    const photos = db.prepare(
      `SELECT * FROM collection_images WHERE category_id = ? ORDER BY sort_order ASC, created_at ASC`
    ).all(req.params.categoryId);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

module.exports = router;
