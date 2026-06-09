// server/middleware/cloudinary.js
// Uses Cloudinary v2 with multer memoryStorage + upload stream.
// No multer-storage-cloudinary needed.

const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
const { Readable } = require('stream');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store upload in memory so we can stream it to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Upload a buffer to Cloudinary and return { url, public_id }
function uploadToCloudinary(buffer, folder = 'studio-portfolio') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

// Express middleware: after multer puts file in req.file.buffer,
// this streams it to Cloudinary and attaches req.file.path / req.file.filename
// so the rest of the route code stays unchanged.
async function processUpload(req, res, next) {
  if (!req.file) return next();
  try {
    const { url, public_id } = await uploadToCloudinary(req.file.buffer);
    req.file.path     = url;        // Cloudinary secure URL
    req.file.filename = public_id;  // Cloudinary public_id (for deletion)
    next();
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
}

module.exports = { cloudinary, upload, processUpload, uploadToCloudinary };
