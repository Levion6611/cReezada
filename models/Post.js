/* server/models/Post.js */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const postSchema = new Schema({
  owner:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, enum: ['text','image','video','clash','multiImage'], required: true },
  title:       { type: String, required: true },
  content:     { type: String }, // texte du post
  mediaUrls:   [{ type: String }], // URLs Cloudinary
  contentFlags:{ type: Map, of: Boolean }, // drapeau(s)
  visibility:  { type: String, required: true },
  appearOnSearch: { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  uploaded:    { type: Boolean, default: true }
});

module.exports = mongoose.model('Post', postSchema);
