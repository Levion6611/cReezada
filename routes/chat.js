/* server/routes/chat.js */
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
module.exports = (io) => {
  const { sendMessage, sendAudio, sendDocument, sendMedia, sendContact } = require('../controllers/chatControllers')(io);

  // ---- Route pour l'envoi de "message texte"
  router.post('/send', sendMessage);

  // ---- Route pour l'envoi d'audio
  router.post(
    '/send-audio',
    upload.single('audioFile'), // Le nom du champ de fichier doit correspondre
    sendAudio
  );

  // ---- Route pour l'envoie des "documents"
  router.post(
    '/send-document',
    upload.single('documentFile'), // Nom du champ de fichier
    sendDocument
  );

  // ---- Route pour l'envoi de "médias"
  router.post(
    '/send-media',
    upload.single('mediaFile'), // Nom du champ de fichier
    sendMedia
  );

  // Route pour l'envoi de "contacts" (pas de middleware multer nécessaire)
  router.post('/send-contact', sendContact);

  return router;
};