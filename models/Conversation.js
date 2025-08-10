/* server/models/Conversation.js */
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: String, required: true }],  
  // Exemple : ['currentUserID', 'contactUserID']

  isFriend: [{
    userID: { type: String, required: true },   
    // l’utilisateur qui valide la relation
    value:    { type: Boolean, default: false }
  }],

  lastMessage:   { type: String, default: '' },
  lastMessageAt: { type: Date,   default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Conversation', conversationSchema);


