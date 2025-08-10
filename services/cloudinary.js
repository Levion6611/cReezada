/* server/services/cloudinary.js */
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadFile(filePath) {
  try {
    const result = await cloudinary.uploader.upload(filePath, { resource_type: 'auto' });
    fs.unlinkSync(filePath);
    return result.secure_url;
  } catch (err) {
    fs.unlink(filePath, () => {});
    throw new Error(`Échec upload Cloudinary: ${err.message}`);
  }
}

module.exports = { uploadFile };



