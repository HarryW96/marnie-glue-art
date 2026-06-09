// server/db/seed.js — run with: npm run db:seed
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

const db = getDb();

const works = [
  { title: 'Sediment I',             year: '2024', category: 'sculpture',    medium: 'Stoneware, iron oxide, found slate',           dimensions: '42 × 28 × 18 cm',       description: 'A meditation on geological time and the strata of lived experience.', price: '£1,400',    available: 1, colour: '#C4956A', sort_order: 1 },
  { title: 'Tender Threshold',        year: '2024', category: 'mixed-media',  medium: 'Linen, beeswax, copper wire, dried botanicals', dimensions: '60 × 45 cm (framed)',    description: 'Layers of encaustic wax suspended over natural linen.',              price: '£880',      available: 1, colour: '#8B6F5E', sort_order: 2 },
  { title: 'Coastline Memory',        year: '2023', category: 'mixed-media',  medium: 'Sea glass, reclaimed timber, gesso, charcoal',  dimensions: '80 × 60 cm',             description: 'Assembled from materials gathered along the Hartlepool coast.',       price: 'Sold',      available: 0, colour: '#B5613A', sort_order: 3 },
  { title: 'Weight of Holding',       year: '2023', category: 'sculpture',    medium: 'Cast iron, raw wool, oak',                      dimensions: '34 × 22 × 22 cm',       description: 'Industrial cast iron cradled in raw fleece, set upon hand-turned oak.', price: '£2,200', available: 1, colour: '#4A3728', sort_order: 4 },
  { title: 'Archive of Small Things', year: '2022', category: 'installation', medium: 'Ceramic, thread, found objects, timber shelf',   dimensions: 'Variable ~180 × 90 cm', description: 'A collection of hand-formed vessels arranged as personal archive.',   price: 'On enquiry',available: 0, colour: '#D4C4A8', sort_order: 5 },
  { title: 'Field Study III',         year: '2022', category: 'mixed-media',  medium: 'Watercolour ground, earth pigment, paper, wax',  dimensions: '50 × 40 cm (unframed)', description: 'Earth pigments from County Durham mixed with beeswax medium.',        price: '£550',      available: 1, colour: '#C4956A', sort_order: 6 },
];

const insertWork = db.prepare(`
  INSERT OR IGNORE INTO works
    (id, title, year, category, medium, dimensions, description, price, available, colour, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

works.forEach(w => {
  insertWork.run(uuidv4(), w.title, w.year, w.category, w.medium,
    w.dimensions, w.description, w.price, w.available, w.colour, w.sort_order);
});

console.log(`✓ Seeded ${works.length} works.`);
