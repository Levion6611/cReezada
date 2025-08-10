/* server/index.js */
require('dotenv').config();

const corsOriginEnv = process.env.CORS_ORIGIN || '*';
// Si tu veux gérer plusieurs origines dans un tableau :
const allowedOrigins = corsOriginEnv.split(',').map(origin => origin.trim());

console.log('🔌 URI utilisée :', process.env.MONGO_URI);

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io'); 

const connectDB = require('./database/connect');
const authRoutes= require('./routes/auth');
const actuRoutes = require('./routes/actu');
const giftRoutes = require('./routes/gift');
const postRoutes = require('./routes/post');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const companiesRoutes = require('./routes/companies');

const app = express();
const server = http.createServer(app);  // Création serveur HTTP natif pour socket.io

// Déclaration du port avant l'utilisation
const PORT = process.env.PORT || 5000;

// Remplace les console.log par un logger structuré
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, error);
    // Ici tu peux ajouter l'envoi vers un outil de monitoring comme Sentry
  }
};

// Socket.IO setup - doit être déclaré AVANT la fonction async pour éviter les erreurs
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

const connectedUsers = new Map(); // userID → Set(socket.id)

// Middleware de validation pour l'authentification WebSocket
io.use((socket, next) => {
  const userID = socket.handshake.query.userID;
  const token = socket.handshake.query.token;
  if (!userID || !token || !validateToken(token, userID)) {
    logger.warn(`Authentification Socket.IO échouée pour userID: ${userID}`);
    return next(new Error('❌ Authentification Socket.IO échouée'));
  }
  logger.info(`Token validé pour l'utilisateur: ${userID}`);
  next();
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Utilisateur connecté, socket id:', socket.id);

  const userID = socket.handshake.query.userID;

  // Socket rejoint une "room" avec son userID pour ciblage direct
  socket.join(userID);

  if (!connectedUsers.has(userID)) {
    connectedUsers.set(userID, new Set());
  }
  connectedUsers.get(userID).add(socket.id);

  console.log(`✅ Utilisateur connecté: ${userID}, socket: ${socket.id}`);

  // Notifie les autres que cet utilisateur est connecté
  socket.broadcast.emit('user_connected', { userID });

  socket.on('error', (err) => {
    logger.error(`Erreur socket pour user ${socket.id}`, err);
  });

  socket.on('disconnect', () => {
    const sockets = connectedUsers.get(userID);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        connectedUsers.delete(userID);
        socket.broadcast.emit('user_disconnected', { userID });
      }
    }
    logger.info(`Utilisateur ${userID} déconnecté, socket: ${socket.id}`);
  });

  // Gestion des rooms pour conversations
  socket.on('joinRoom', (conversationID) => {
    socket.join(conversationID);
    console.log(`Socket ${socket.id} rejoint la room ${conversationID}`);
  });

  socket.on('leaveRoom', (conversationID) => {
    socket.leave(conversationID);
    console.log(`Socket ${socket.id} quitte la room ${conversationID}`);
  });

  // Événement de saisie (typing)
  socket.on('typing', ({ conversationID, userID, isTyping }) => {
    socket.to(conversationID).emit('typing', { userID, isTyping });
  });

  // Messages lus
  socket.on('message_read_request', (data) => {
    const { conversationId, readerId } = data;
    io.to(conversationId).emit('message_read', {
      conversationId,
      readerId,
      readAt: new Date().toISOString(),
    });
  });

  // Messages délivrés
  socket.on('message_delivered_request', (data) => {
    const { conversationId, receiverId } = data;
    io.to(conversationId).emit('message_delivered', {
      conversationId,
      receiverId,
      deliveredAt: new Date().toISOString(),
    });
  });
});

io.engine.on('connection_error', (err) => {
  logger.error("Erreur de connexion Socket.IO", err);
});

// Fonction de validation (à implémenter selon ta logique)
function validateToken(token, userID) {
  // Par exemple : jwt.verify(token, process.env.JWT_SECRET)
  return true; // Placeholder à remplacer
}

// Démarrage du serveur principal et connexion à la base de données
(async () => {
  try {
    await connectDB();
    logger.info("✅ Connexion MongoDB réussie");

    // Middlewares
    app.use(cors({origin: allowedOrigins}));
    app.use(express.json());
    app.use((req, res, next) => {
      console.log(`📥 ${req.method} ${req.url}`);
      next();
    });

    // Passer les instances aux routes si besoin
    app.set('socketio', io);
    app.set('connectedUsers', connectedUsers);

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/actu', actuRoutes(io));
    app.use('/api/gift', giftRoutes);
    app.use('/api/post', postRoutes);
    app.use('/api/companies', companiesRoutes);
    app.use('/api/chat', chatRoutes(io));

    // Lancer l'écoute du serveur
    server.listen(PORT, () => logger.info(`✅ Serveur en écoute sur le port ${PORT}`));
  } catch (err) {
    logger.error("❌ Échec connexion MongoDB", err);
    process.exit(1);
  }
})();

