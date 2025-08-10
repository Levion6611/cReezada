/* server/controllers/authController.js */
const User = require('../models/User');

/// Gère le processus d'inscription d'un nouvel utilisateur.
exports.register = async (req, res) => {
  console.log('✅  Démarrage de l\'inscription');
  try {
    const { anonymous, name, gender, location, type, hasAccount, isLoggedIn } = req.body;

    if (!anonymous || !name || !gender || !location) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const { country, city, district } = location;
    if (!country || !city || !district) {
      return res.status(400).json({ message: 'Localisation incomplète.' });
    }

    // Générer un userID basé sur le nom et le timestamp
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const uniqueSuffix = Date.now().toString().substring(6); // prend juste les derniers chiffres
    const userID = `${cleanName.replace(/\s+/g, '').toLowerCase()}_${uniqueSuffix}`;

    const newUser = new User({
      userID,
      type,
      anonymous,
      name,
      gender,
      location: { country, city, district },
      badge: 'none',
      isVerified: false,
      contentLike: 0,
      hasAccount: hasAccount ?? true,
      isLoggedIn: isLoggedIn ?? true,
    });

    await newUser.save();
    console.log('✅ Utilisateur enregistré avec succès');

    return res.status(201).json({
      message: 'Inscription réussie',
      user: {
        id: String(newUser._id),
        userID: newUser.userID,
        type: newUser.type,
        anonymous: newUser.anonymous,
        name: newUser.name,
        gender: newUser.gender,
        location: newUser.location,
        layoos: newUser.layoos,
        dailyStats: newUser.dailyStats,
        badge: newUser.badge,
        isVerified: newUser.isVerified,
        hasAccount: newUser.hasAccount,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      },
    });
  } catch (err) {
    console.error('❌ Erreur MongoDB:', err.message);
    return res.status(500).json({ message: err.message || '❌ Erreur serveur.' });
  }
};


/// Gère la modification des informations de profil d'un utilisateur existant.
exports.updateUser = async (req, res) => {
  try {
    const { userId, anonymous, name, phone, dob, regions, status, bio } = req.body;

    if (!userId) {
      return res.status(400).json({ message: '❌ userId est requis' });
    }

    // Construire un objet à mettre à jour avec les champs reçus
    const updateData = {};
    if (anonymous !== undefined) updateData.anonymous = anonymous;
    if (name !== undefined) updateData.name = name;
    // Ajouter d’autres champs selon ta base (phone, dob, regions, status, bio)
    // Pour exemple, je mets en commentaire car modèle MongoDB différent
    if (phone !== undefined) updateData.phone = phone;
    if (dob !== undefined) updateData.dob = dob;
    if (regions !== undefined) updateData.regions = regions;
    if (status !== undefined) updateData.status = status;
    if (bio !== undefined) updateData.bio = bio;

    // Mettre à jour dans la base Mongo
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: '❌ Utilisateur non trouvé' });
    }

    res.json({ message: '✅ Profil mis à jour', user: updatedUser });
  } catch (error) {
    console.error('❌ Erreur mise à jour utilisateur:', error);
    res.status(500).json({ message: '❌ Erreur serveur' });
  }
};