const Post = require('../models/Post');
const { uploadFile } = require('../services/cloudinary');

/// Gère la création d'une nouvelle publication, incluant la gestion de fichiers multimédia.
exports.createPost = async (req, res) => {
  try {
    // 1️⃣ Upload des fichiers si présents
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadFile(file.path);
        mediaUrls.push(url);
      }
    }

    // 2️⃣ Créer le post
    const { userID, type, title, contentText, contentFlags, visibility, appearOnSearch } = req.body;
    const newPost = await Post.create({
      id: id,
      userID: userID,
      type,
      title,
      contentText: contentText,
      mediaUrls,
      contentFlags: JSON.parse(contentFlags || '{}'),
      visibility,
      appearOnSearch: appearOnSearch === 'true',
      createdAt: new Date(),
      uploaded: true
    });

    // 3️⃣ Répondre avec le document complet
    res.status(201).json({
      id: newPost._id,
      userID: newPost.userID,
      name: req.body.name,             // assure-toi de l’envoyer depuis le client
      profileImage: req.body.profileImage,
      type: newPost.type,
      title: newPost.title,
      content: newPost.content,
      mediaUrls: newPost.mediaUrls,
      contentFlags: Object.fromEntries(newPost.contentFlags),
      visibility: newPost.visibility,
      appearOnSearch: newPost.appearOnSearch,
      createdAt: newPost.createdAt.toISOString()
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: '❌ Impossible de créer le post.' });
  }
};

/// Permet à un utilisateur de voir les publications de ses contacts.
exports.getReceivedPosts = async (req, res) => {
  try {
    const { userID } = req.params;
    const user = await User.findById(userID).select('contactsPhone');
    const contacts = user.contactsPhone;
    const posts = await Post.find({
      owner: { $in: contacts }
    })
    .sort({ createdAt: -1 })
    .lean();

    // Retourner sous forme JSON que client client attend
    res.json(posts.map(p => ({
      id: p._id,
      userID: p.userID,
      name: p.name,
      profileImage: p.profileImage,
      type: p.type,
      title: p.title,
      contentText: p.contentText,
      mediaUrls: p.mediaUrls,
      contentFlags: Object.fromEntries(p.contentFlags),
      visibility: p.visibility,
      appearOnSearch: p.appearOnSearch,
      createdAt: p.createdAt.toISOString()
    })));
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: '❌ Impossible de récupérer les posts.' });
  }
};
