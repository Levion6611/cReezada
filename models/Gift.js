/* server/models/Gift.js */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const giftSchema = new Schema({
  type: { type: String, enum: ['text', 'image', 'video'], required: true },
  content: { type: String, required: true },
  caption: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  viewersCount: { type: Number, default: 0 },
  viewedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }], // même logique que Actu

  recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  dislikeBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});

module.exports = mongoose.model('Gift', giftSchema);
