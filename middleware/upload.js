/* server/middleware/upload.js */
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});

// Filtre MIME
function fileFilter(req, file, cb) {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mpeg', 'video/quicktime',
    'audio/mpeg', 'audio/mp3'
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Type de fichier non autorisé'), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 Mo
});

module.exports = upload;


