/* server/routes/userCompanies.js */
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// PATCH /api/user/:userID/companies - body: { companyID: String }
/// Ajoute l'identifiant d'un "utilisateur" à la liste des "compagnies" d'un utilisateur.
router.patch('/:userID/companies', async (req, res) => {
  try {
    const { userID } = req.params;
    const { companyID } = req.body;

    // On utilise $addToSet pour éviter les doublons
    const user = await User.findOneAndUpdate(
      { userID },
      { $addToSet: { companies: companyID } },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: '❌ Utilisateur introuvable' });
    }
    res.json({ companies: user.companies });
  } catch (err) {
    console.error('❌ Erreur PATCH /user/:userID/companies:', err);
    res.status(500).json({ error: '❌ Erreur serveur' });
  }
});

module.exports = router;

// GET /user/:userID/companies
// Récupére la liste des `companies` liées à l'utilisateur
router.get('/:userID/companies', async (req, res) => {
  try {
    const { userID } = req.params;
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: '❌ Utilisateur introuvable' });

    res.json({ companies: user.companies });
  } catch (err) {
    console.error('❌ Erreur GET /user/:userID/companies:', err);
    res.status(500).json({ error: '❌ Erreur serveur' });
  }
});
