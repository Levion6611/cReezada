/* server/routes/conversation.js */
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// GET /api/conversations/:userID
/// Elle permet à un utilisateur de voir avec qui il a déjà discuté.
/// Récupérer les conversations d'un utilisateur
router.get('/:userID', async (req, res) => {
  try {
    const { userID } = req.params;
    const convos = await Conversation.find({
      participants: userID
    }).lean();

    // On renvoie juste les userID des autres participants
    const summary = convos.map(c => {
      const contactID = c.participants.find(id => id !== userID);
      const friendFlag = c.isFriend.find(f => f.userID === userID)?.value ?? false;
      return {
        contactID,
        hasChatted: true,
        isFriend: friendFlag,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt
      };
    });

    res.json({ conversations: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Erreur serveur' });
  }
});

// POST /api/conversations - body: { userID, contactID }
// Créer ou récupérer une conversation existante
/// Cette route est appelée lorsqu'un utilisateur souhaite commencer une nouvelle conversation avec
/// un autre utilisateur. Elle évite la création de doublons en vérifiant d'abord si une conversation 
/// entre ces deux participants existe déjà.
router.post('/', async (req, res) => {
    try {
      const { userID, contactID } = req.body;
  
      // Cherche s’il existe déjà
      let convo = await Conversation.findOne({
        participants: { $all: [userID, contactID] }
      });
  
      if (!convo) {
        convo = new Conversation({
          participants: [userID, contactID],
          isFriend: [
            { userID, value: true },       // l’utilisateur confirme direct
            { userID: contactID, value: false }
          ]
        });
        await convo.save();
      } else {
        // S’il existe déjà, on peut mettre à jour isFriend pour l’utilisateur
        convo.isFriend = convo.isFriend.map(f =>
          f.userID === userID ? { userID, value: true } : f
        );
        await convo.save();
      }
  
      res.status(201).json({
        conversationID: convo._id.toString(),
        contactID,
        isFriend: true
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '❌ Erreur serveur' });
    }
  });
  
  module.exports = router;

// GET /api/messages/unread/:userID
/// Récupére les messages non lus
/// Charge un aperçu des messages non lus pour un utilisateur donné, sans avoir à charger l'intégralité
/// de toutes les conversations.
router.get('/messages/unread/:userID', async (req, res) => {
  try {
    const { userID } = req.params;

    const conversations = await Conversation.find({
      participants: userID
    });

    const convoIDs = conversations.map(c => c._id);

    const messages = await Message.find({
      conversationID: { $in: convoIDs },
      seenBy: { $ne: userID }, // non vu par l’utilisateur
      senderID: { $ne: userID } // messages reçus
    }).sort({ createdAt: -1 });

    // Résumé par conversation
    const grouped = {};
    for (const msg of messages) {
      const convoID = msg.conversationID.toString();
      if (!grouped[convoID]) grouped[convoID] = [];
      grouped[convoID].push(msg);
    }

    res.json({ unread: grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Erreur serveur' });
  }
});

// PATCH /api/messages/seen - body: { userID, conversationID }
/// Marquer les messages comme “vus”
/// Cette route est appelée lorsqu'un utilisateur ouvre une conversation, pour signaler au serveur que
/// tous les messages non lus de cette discussion doivent être marqués comme vus
router.patch('/messages/seen', async (req, res) => {
  try {
    const { userID, conversationID } = req.body;
    await Message.updateMany(
      {
        conversationID,
        seenBy: { $ne: userID }
      },
      { $addToSet: { seenBy: userID } }
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Erreur serveur' });
  }
});


  
