/* server/controllers/giftController.js */
const Gift = require('../models/Gift');
const User = require('../models/User');
const { uploadFile } = require('../services/cloudinary');

/// Gère la logique de création d'une nouvelle "Gift".
exports.createGift = async (req, res) => {
  try {
    const recipientIds = JSON.parse(req.body.recipientIds || '[]');
    let mediaUrl = null;
    if (req.file) {
      mediaUrl = await uploadFile(req.file.path);
    }
    const { type, caption, ownerId } = req.body;
    const now = new Date();
    const newGift = await Gift.create({
      type,
      content: mediaUrl || req.body.content,
      caption,
      owner: ownerId,
      recipients: recipientIds,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 2*24*60*60*1000),
      isActive: true,
    });

    // 🔔 Émission de l'événement Socket.IO
    const io = req.app.get('socketio');
    const connectedUsers = req.app.get('connectedUsers');

    for (const recipientId of recipientIds) {
      const socketIds = connectedUsers.get(recipientId);
      if (socketIds) {
        for (const socketId of socketIds) {
          io.to(socketId).emit('new_gift', newGift);
          console.log(`🎁 Événement 'new_gift' émis vers l'utilisateur ${recipientId}`);
        }
      }
    }

    res.status(201).json(newGift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Impossible de créer le gift.' });
  }
};

/// Récupére les "gifts" que l'utilisateur a reçus de ses contacts.
exports.getReceivedGifts = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('contactsPhone');
    const contacts = user.contactsPhone;
    const now = new Date();
    const gifts = await Gift.find({
      owner: { $in: contacts },
      expiresAt: { $gt: now },
      isActive: true,
    })
    .sort({ createdAt: -1 })
    .lean();
    res.json(gifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Impossible de récupérer les gifts.' });
  }
};

// --- 
exports.likeGift = async (req, res) => {
  try {
    const { userId } = req.body;
    const gift = await Gift.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { likedBy: userId } }, // Utilisation de $addToSet
      { new: true }
    );
    if (!gift) {
      return res.status(404).send({ message: 'Gift non trouvé.' });
    }
    // 🔔 Émission de l'événement Socket.IO vers le propriétaire
    const io = req.app.get('socketio');
    const connectedUsers = req.app.get('connectedUsers');
    const ownerSocketIds = connectedUsers.get(gift.owner.toString());
    if (ownerSocketIds) {
      for (const socketId of ownerSocketIds) {
        io.to(socketId).emit('gift_liked', { giftId: gift._id, userId });
      }
    }
    res.status(200).send({ message: 'Gift aimé.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// ---
exports.dislikeGift = async (req, res) => {
  try {
    const { userId } = req.body;
    const gift = await Gift.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { dislikeBy: userId } }, // Utilisation de $addToSet
      { new: true }
    );
    if (!gift) {
      return res.status(404).send({ message: 'Gift non trouvé.' });
    }
    // 🔔 Émission de l'événement Socket.IO vers le propriétaire
    const io = req.app.get('socketio');
    const connectedUsers = req.app.get('connectedUsers');
    const ownerSocketIds = connectedUsers.get(gift.owner.toString());
    if (ownerSocketIds) {
      for (const socketId of ownerSocketIds) {
        io.to(socketId).emit('gift_disliked', { giftId: gift._id, userId });
      }
    }
    res.status(200).send({ message: 'Gift non aimé.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// --- Marque les utilisateurs qui ont lu
exports.markGiftAsRead = async (req, res) => {
  try {
    const { userId } = req.body;
    const gift = await Gift.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { viewedBy: userId } },
      { new: true } // Renvoie le document mis à jour
    );
    if (!gift) {
      return res.status(404).send({ message: 'Gift non trouvé.' });
    }
    // TODO: Notifier l'expéditeur en temps réel
    res.status(200).send({ message: 'Gift marqué comme lu.', viewedBy: gift.viewedBy });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};
