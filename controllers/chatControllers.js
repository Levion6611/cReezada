/* server/controllers/chatController.js */
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const mongoose = require('mongoose');

// Importation de notre service Cloudinary
const cloudinary = require('../services/cloudinary');

// Le contrôleur a besoin de l'instance 'io' de Socket.IO
// Pour cela, nous allons passer `io` au contrôleur.
module.exports = (io) => {
  const sendMessage = async (req, res) => {
    const { id, conversationID, senderID, content, type } = req.body;

    // Validation simple des données
    if (!conversationID || !senderID || !content) {
      return res.status(400).json({ error: '❌ Missing required fields' });
    }

    // Démarre une session de transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Vérification d'idempotence : Le message existe-t-il déjà ?
      const existingMessage = await Message.findOne({ _id: id }).session(session);
      if (existingMessage) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ message: 'Message already processed' });
      }

      // 1. Sauvegarde en base de données
      const newMessage = new Message({
        _id: id, // Utilisation de l'ID fourni par le client
        conversationID,
        senderID,
        content,
        type,
        seenBy: [senderID],
      });
      await newMessage.save({ session });

      // 2. Mise à jour de la dernière info de la conversation
      await Conversation.findByIdAndUpdate(
        conversationID,
        {
          lastMessage: content,
          lastMessageAt: newMessage.createdAt,
        },
        { new: true, session }
      );

      // Si tout s'est bien passé, on valide la transaction
      await session.commitTransaction();
      session.endSession();

      // 3. Émission du message via Socket.IO
      io.to(conversationID).emit('new_message', {
        id: newMessage._id,
        conversationID,
        senderID,
        content,
        type,
        createdAt: newMessage.createdAt,
        seenBy: newMessage.seenBy,
      });

      // 4. Réponse au client
      res.status(200).json({ success: true, message: '✅ Message sent successfully', messageId: newMessage._id.toString() });

    } catch (error) {
      // En cas d'erreur, on annule la transaction
      await session.abortTransaction();
      session.endSession();
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      res.status(500).json({ error: '❌ Internal server error' });
    }
  };

  // --- Audio
  const sendAudio = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Récupérer les données du message
      const messageData = JSON.parse(req.body.messageData);
      const audioFile = req.file;

      if (!messageData || !audioFile) {
        return res.status(400).json({ error: '❌ Missing required fields' });
      }

      const { id, conversationID, senderID, payload, type } = messageData;

      // Vérification d'idempotence :
      const existingMessage = await Message.findOne({ _id: id }).session(session);
      if (existingMessage) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ message: 'Message already processed' });
      }

      // 2. Envoi du fichier à Cloudinary
      const audioUrl = await cloudinary.uploadFile(audioFile.path);

      // 3. Sauvegarde en base de données avec l'URL de Cloudinary
      const newMessage = new Message({
        _id: id,
        conversationID,
        senderID,
        content: audioUrl, // Stockage de l'URL du fichier sur Cloudinary
        type,
        seenBy: [senderID],
        payload: { ...payload, audioUrl }, // Mise à jour du payload avec l'URL
      });
      await newMessage.save({ session });

      // 4. Mise à jour de la dernière info de la conversation
      await Conversation.findByIdAndUpdate(
        conversationID,
        {
          lastMessage: 'Audio',
          lastMessageAt: newMessage.createdAt,
        },
        { new: true, session }
      );

      // Si tout s'est bien passé, on valide la transaction
      await session.commitTransaction();
      session.endSession();

      // 5. Émission du message via Socket.IO
      io.to(conversationID).emit('new_message', {
        id: newMessage._id,
        conversationID,
        senderID,
        content: newMessage.content,
        type: newMessage.type,
        createdAt: newMessage.createdAt,
        seenBy: newMessage.seenBy,
        payload: newMessage.payload,
      });

      res.status(200).json({ message: '✅ Audio sent successfully', messageId: id });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('❌ Erreur lors de l\'envoi de l\'audio:', error);
      res.status(500).json({ error: '❌ Internal server error' });
    }
  };

  // --- Documents
  const sendDocument = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const messageData = JSON.parse(req.body.messageData);
      const documentFile = req.file;

      if (!messageData || !documentFile) {
        return res.status(400).json({ error: '❌ Missing required fields' });
      }

      const { id, conversationID, senderID, payload, type } = messageData;

      const existingMessage = await Message.findOne({ _id: id }).session(session);
      if (existingMessage) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ message: 'Message already processed' });
      }

      // 1. Envoi du fichier à Cloudinary
      const fileUrl = await cloudinary.uploadFile(documentFile.path);

      // 2. Sauvegarde en base de données avec l'URL de Cloudinary
      const newMessage = new Message({
        _id: id,
        conversationID,
        senderID,
        content: fileUrl, // L'URL du fichier dans Cloudinary
        type,
        seenBy: [senderID],
        payload: { ...payload, fileUrl }, // Ajout de l'URL au payload
      });
      await newMessage.save({ session });

      // 3. Mise à jour de la conversation
      await Conversation.findByIdAndUpdate(
        conversationID,
        {
          lastMessage: 'Document',
          lastMessageAt: newMessage.createdAt,
        },
        { new: true, session }
      );

      await session.commitTransaction();
      session.endSession();

      // 4. Émission du message via Socket.IO
      io.to(conversationID).emit('new_message', {
        id: newMessage._id,
        conversationID,
        senderID,
        content: newMessage.content,
        type: newMessage.type,
        createdAt: newMessage.createdAt,
        seenBy: newMessage.seenBy,
        payload: newMessage.payload,
      });

      res.status(200).json({ 
        message: 'Document sent successfully', 
        messageId: id,
        fileUrl, // Renvoyer l'URL au client pour mettre à jour le message local
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('❌ Erreur lors de l\'envoi du document:', error);
      res.status(500).json({ error: '❌ Internal server error' });
    }
  };

  // ---- Media (video, image)
  const sendMedia = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const messageData = JSON.parse(req.body.messageData);
      const mediaFile = req.file;

      if (!messageData || !mediaFile) {
        return res.status(400).json({ error: '❌ Missing required fields' });
      }

      const { id, conversationID, senderID, payload, type } = messageData;

      const existingMessage = await Message.findOne({ _id: id }).session(session);
      if (existingMessage) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ message: 'Message already processed' });
      }

      // 1. Envoi du fichier à Cloudinary
      const mediaUrl = await cloudinary.uploadFile(mediaFile.path);

      // 2. Sauvegarde en base de données avec l'URL de Cloudinary
      const newMessage = new Message({
        _id: id,
        conversationID,
        senderID,
        content: mediaUrl,
        type,
        seenBy: [senderID],
        payload: { ...payload, mediaUrl },
      });
      await newMessage.save({ session });

      // 3. Mise à jour de la conversation
      await Conversation.findByIdAndUpdate(
        conversationID,
        {
          lastMessage: 'Média',
          lastMessageAt: newMessage.createdAt,
        },
        { new: true, session }
      );

      await session.commitTransaction();
      session.endSession();

      // 4. Émission du message via Socket.IO
      io.to(conversationID).emit('new_message', {
        id: newMessage._id,
        conversationID,
        senderID,
        content: newMessage.content,
        type: newMessage.type,
        createdAt: newMessage.createdAt,
        seenBy: newMessage.seenBy,
        payload: newMessage.payload,
      });

      res.status(200).json({ 
        message: 'Media sent successfully', 
        messageId: id,
        mediaUrl,
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('❌ Erreur lors de l\'envoi du média:', error);
      res.status(500).json({ error: '❌ Internal server error' });
    }
  };

  // ---- Contacts
  const sendContact = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id, conversationID, senderID, payload, type } = req.body;

      if (!conversationID || !senderID || !payload) {
        return res.status(400).json({ error: '❌ Missing required fields' });
      }

      const existingMessage = await Message.findOne({ _id: id }).session(session);
      if (existingMessage) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ message: 'Message already processed' });
      }

      const newMessage = new Message({
        _id: id,
        conversationID,
        senderID,
        content: `Contact: ${payload.contactName}`, // Contenu simple pour la dernière entrée de conversation
        type,
        seenBy: [senderID],
        payload, // ✅ Stockage du payload complet
      });
      await newMessage.save({ session });

      await Conversation.findByIdAndUpdate(
        conversationID,
        {
          lastMessage: 'Contact',
          lastMessageAt: newMessage.createdAt,
        },
        { new: true, session }
      );

      await session.commitTransaction();
      session.endSession();

      io.to(conversationID).emit('new_message', {
        id: newMessage._id,
        conversationID,
        senderID,
        content: newMessage.content,
        type: newMessage.type,
        createdAt: newMessage.createdAt,
        seenBy: newMessage.seenBy,
        payload: newMessage.payload,
      });

      res.status(200).json({ message: 'Contact sent successfully', messageId: id });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('❌ Erreur lors de l\'envoi du contact:', error);
      res.status(500).json({ error: '❌ Internal server error' });
    }
  };

  return { sendMessage, sendAudio, sendDocument, sendMedia, sendContact };
};
