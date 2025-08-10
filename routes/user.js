/* server/routes/user.js */
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/user/check-contacts
/// Permettre à un utilisateur de vérifier lesquels de ses contacts téléphoniques
/// (fournis par le client) ont déjà un compte sur la plateforme
router.post('/check-contacts', async (req, res) => {
  try {
    const { phones } = req.body;

    if (!Array.isArray(phones)) {
      return res.status(400).json({ error: '❌ Phones must be an array' });
    }

    // Nettoyage et normalisation des numéros
    const cleanedPhones = phones.map(p => p.replace(/\D/g, ''));

    // Trouve les utilisateurs avec un numéro correspondant
    const users = await User.find({ phone: { $in: cleanedPhones } });

    const result = cleanedPhones.map((phone) => {
      const user = users.find(u => u.phone.replace(/\D/g, '') === phone);
      return {
        phone,
        hasAccount: !!user,
        userID: user?.userID ?? null,
        badge: user?.badge ?? 'none',
        type: user?.type ?? 'company',
        secure: user?.secure ?? false,
      };
    });

    res.json({ matches: result });
  } catch (err) {
    console.error('❌ Erreur /check-contacts :', err);
    res.status(500).json({ error: '❌ Erreur serveur' });
  }
});

module.exports = router;
