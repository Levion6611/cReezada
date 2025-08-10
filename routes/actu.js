/* server/routes/actu.js */
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const actuController = require('../controllers/actuController');

module.exports = (io) => {
  const { createActu, getReceivedActus, markActuAsRead } = actuController(io);

  // Accept any files (file0, file1, ...) and fields: owner, recipientIds, parts (JSON)
  router.post('/', upload.any(), createActu);
  router.get('/received/:userId', getReceivedActus);
  router.post('/mark-read', markActuAsRead);

  return router;
};
