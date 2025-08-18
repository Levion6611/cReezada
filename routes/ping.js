/* server/routes/ping.js */
const express = require('express');
const router = express.Router();

// GET /api/ping
router.get('/', (req, res) => {
  res.status(200).send('✅ OK');
});

module.exports = router;
