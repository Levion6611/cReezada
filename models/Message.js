/* server/models/Message.js */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationID: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Conversation' },
  senderID: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['text', 'image', 'audio', 'video', 'document', 'response', 'post'], 
    default: 'text' 
  },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  seenBy: {
    type: [String],
    default: []
  }, // liste des userID ayant vu ce message
});

module.exports = mongoose.model('Message', messageSchema);