/* server/routes/auth.js */
const express = require('express');
const router  = express.Router();
const User = require('../models/User');
const { register, updateUser } = require('../controllers/authController');

// POST /api/auth/register - Route d'inscription
router.post('/register', register);

// PUT /api/auth/update - Route de mide a jour
router.put('/update', updateUser);

module.exports = router;
