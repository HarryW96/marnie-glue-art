// server/db/database.js
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../../studio.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      slug       TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS works (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      year        TEXT NOT NULL,
      category    TEXT NOT NULL,
      medium      TEXT DEFAULT '',
      dimensions  TEXT DEFAULT '',
      description TEXT DEFAULT '',
      price       TEXT DEFAULT 'On enquiry',
      available   INTEGER DEFAULT 1,
      colour      TEXT DEFAULT '#C4956A',
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_images (
      id          TEXT PRIMARY KEY,
      work_id     TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      image_url   TEXT NOT NULL,
      image_id    TEXT NOT NULL,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      subject    TEXT DEFAULT 'General',
      message    TEXT NOT NULL,
      work_id    TEXT REFERENCES works(id) ON DELETE SET NULL,
      read       INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add description column to categories
  try {
    db.exec(`ALTER TABLE categories ADD COLUMN description TEXT DEFAULT ''`);
  } catch (_) { /* column already exists */ }

  // Add links column to categories
  try {
    db.exec(`ALTER TABLE categories ADD COLUMN links TEXT DEFAULT '[]'`);
  } catch (_) { /* column already exists */ }

  // Collection photos (press shots, exhibition images) per category
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_images (
      id          TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      image_url   TEXT NOT NULL,
      image_id    TEXT NOT NULL,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing single-image works → work_images table
  // (safe to run multiple times — checks for existing rows first)
  try {
    const cols = db.prepare(`PRAGMA table_info(works)`).all().map(c => c.name);
    if (cols.includes('image_url')) {
      const worksWithImages = db.prepare(
        `SELECT id, image_url, image_id FROM works WHERE image_url != '' AND image_url IS NOT NULL`
      ).all();
      const insertImg = db.prepare(
        `INSERT OR IGNORE INTO work_images (id, work_id, image_url, image_id, sort_order)
         VALUES (?, ?, ?, ?, 0)`
      );
      worksWithImages.forEach(w => {
        const exists = db.prepare(`SELECT id FROM work_images WHERE work_id = ?`).get(w.id);
        if (!exists) insertImg.run(`img-${w.id}`, w.id, w.image_url, w.image_id);
      });
      // Drop old columns (SQLite 3.35+ supports DROP COLUMN)
      try {
        db.exec(`ALTER TABLE works DROP COLUMN image_url`);
        db.exec(`ALTER TABLE works DROP COLUMN image_id`);
      } catch (_) { /* already dropped or unsupported version */ }
    }
  } catch (_) { /* works table doesn't have image columns — already migrated */ }

  // Default categories
  const insertCat = db.prepare(
    `INSERT OR IGNORE INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)`
  );
  [
    ['cat-1', 'Sculpture',    'sculpture',    1],
    ['cat-2', 'Mixed Media',  'mixed-media',  2],
    ['cat-3', 'Installation', 'installation', 3],
  ].forEach(([id, name, slug, sort_order]) => insertCat.run(id, name, slug, sort_order));

  // Default site settings
  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)`
  );
  [
    ['artist_name', 'Studio'],
    ['tagline',     'Mixed Media & Sculpture'],
    ['email',       'studio@example.com'],
    ['instagram',   '@studio.artist'],
    ['location',    'Hartlepool, England'],
    ['bio',         'My practice sits at the intersection of the found and the formed.'],
  ].forEach(([k, v]) => insertSetting.run(k, v));
}

module.exports = { getDb };
