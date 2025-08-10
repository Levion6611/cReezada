/* server/models/Actu.js */
const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
  type: { type: String, enum: ['text', 'photo', 'video', 'audio', 'gif'], required: true },
  url: { type: String },           // URL finale (Cloudinary) pour media parts
  text: { type: String },          // caption / texte attaché
  duration: { type: Number },      // seconds, for video/audio
  thumbnailUrl: { type: String },  // optional thumbnail for videos/gifs
}, { _id: false });

const viewSchema = new mongoose.Schema({
  viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  viewedAt: { type: Date, default: Date.now },
  viewDuration: { type: Number, default: 0 },
}, { _id: false });

const actuSchema = new mongoose.Schema({
  parts: { type: [partSchema], required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, required: true },
  views: [viewSchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// TTL index to remove expired documents (Mongo will delete when expiresAt <= now)
actuSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Actu', actuSchema);


