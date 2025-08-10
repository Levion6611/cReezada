/* server/controllers/actuController.js */
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { v4: uuidv4 } = require('uuid');

const Actu = require('../models/Actu');
const User = require('../models/User');
const { uploadFile } = require('../services/cloudinary');

// Configure ffmpeg / ffprobe paths (portable)
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic && ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

// Ensure uploads dir exists (multer writes here)
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    console.error('Impossible de créer uploads dir:', e);
  }
}

/**
 * Extract media duration (seconds) using ffprobe via fluent-ffmpeg.
 * Returns integer seconds or null on error.
 */
const getMediaDuration = async (localPath) => {
  return new Promise((resolve) => {
    try {
      ffmpeg.ffprobe(localPath, (err, metadata) => {
        if (err || !metadata) {
          console.error('ffprobe error:', err);
          return resolve(null);
        }
        const durFloat = metadata.format && metadata.format.duration ? metadata.format.duration : null;
        const dur = durFloat != null ? Math.round(durFloat) : null;
        resolve(dur);
      });
    } catch (e) {
      console.error('getMediaDuration exception:', e);
      resolve(null);
    }
  });
};

/**
 * Generate a video thumbnail (jpeg) at `seekTimeInSec` (default 2s).
 * Returns the local path to the thumbnail file or null if failed.
 *
 * NOTE: This function only generates a local thumbnail file.
 * Caller is responsible for uploading it and deleting if needed.
 */
const generateVideoThumbnail = async (localPath, options = {}) => {
  const seek = typeof options.seekTimeInSec === 'number' ? options.seekTimeInSec : 2;
  const outName = `thumb-${Date.now()}-${uuidv4()}.jpg`;
  const outPath = path.join(uploadsDir, outName);

  return new Promise((resolve) => {
    try {
      ffmpeg(localPath)
        .on('end', () => {
          if (fs.existsSync(outPath)) {
            return resolve(outPath);
          } else {
            console.error('Thumbnail not created at', outPath);
            return resolve(null);
          }
        })
        .on('error', (err) => {
          console.error('generateVideoThumbnail error:', err);
          try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {}
          return resolve(null);
        })
        .screenshots({
          timestamps: [seek],
          filename: outName,
          folder: path.dirname(outPath),
          size: '640x?'
        });
    } catch (e) {
      console.error('generateVideoThumbnail exception:', e);
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {}
      resolve(null);
    }
  });
};

/**
 * Controller factory: inject io (socket.io instance).
 */
module.exports = (io) => {
  /**
   * POST /api/actu
   * Expects multipart/form-data:
   *  - owner (string) -- recommended to be ignored in favor of auth middleware in production
   *  - recipientIds (JSON stringified array) e.g. '["id1","id2"]'
   *  - parts (JSON string) e.g. '[{"type":"photo","fileIndex":0,"text":"cap"},{"type":"text","text":"hello"}]'
   *  - files named file0, file1, ... matching fileIndex values
   */
  const createActu = async (req, res) => {
    try {
      const { owner, recipientIds } = req.body;

      // Basic validation
      if (!owner) return res.status(400).json({ message: 'Owner ID requis.' });
      if (!recipientIds) return res.status(400).json({ message: 'recipientIds requis.' });

      // Parse parts
      let partsPayload = [];
      if (req.body.parts) {
        try {
          partsPayload = typeof req.body.parts === 'string' ? JSON.parse(req.body.parts) : req.body.parts;
          if (!Array.isArray(partsPayload) || partsPayload.length === 0) {
            return res.status(400).json({ message: 'Le champ parts doit être un tableau non vide.' });
          }
        } catch (err) {
          return res.status(400).json({ message: 'JSON invalide dans parts.' });
        }
      } else {
        // Backward compatibility: if client used old single content fields
        if (req.body.content) {
          partsPayload = [{
            type: req.body.type || (req.body.content ? 'photo' : 'text'),
            text: req.body.caption || null,
            url: req.body.content || null
          }];
        } else {
          return res.status(400).json({ message: 'Aucun contenu fourni.' });
        }
      }

      // Build files map from multer's req.files (upload.any())
      const uploadedFiles = req.files || []; // array of { fieldname, path, mimetype, ... }
      const filesMap = {};
      for (const f of uploadedFiles) {
        filesMap[f.fieldname] = f;
      }

      // Process parts: for any part with fileIndex -> generate duration/thumbnail (if video) BEFORE uploading
      for (let i = 0; i < partsPayload.length; i++) {
        const p = partsPayload[i];

        if (p.fileIndex !== undefined && p.fileIndex !== null) {
          const fieldName = `file${p.fileIndex}`;
          const fileObj = filesMap[fieldName];
          if (!fileObj) {
            // Clean up any generated thumbnail files to avoid leaks
            return res.status(400).json({ message: `Fichier manquant pour fileIndex ${p.fileIndex}` });
          }

          const mimetype = (fileObj.mimetype || '').toLowerCase();

          // If video: extract duration and generate thumbnail BEFORE upload (uploadFile deletes local media)
          if (mimetype.startsWith('video')) {
            try {
              const durationSec = await getMediaDuration(fileObj.path);
              if (durationSec != null) p.duration = durationSec;
            } catch (e) {
              // non-blocking, continue
              console.error('Erreur extraction durée vidéo:', e);
            }

            try {
              const thumbLocalPath = await generateVideoThumbnail(fileObj.path, { seekTimeInSec: 2 });
              if (thumbLocalPath) {
                // upload thumbnail to Cloudinary and set thumbnailUrl on part
                try {
                  const thumbUrl = await uploadFile(thumbLocalPath);
                  p.thumbnailUrl = thumbUrl;
                } catch (err) {
                  console.error('upload thumbnail failed:', err);
                  // continue without thumbnail
                }
              }
            } catch (e) {
              console.error('generateVideoThumbnail exception:', e);
            }
          } else if (mimetype.startsWith('image')) {
            // Optionally: could generate smaller preview or compress image
            // For now, nothing extra needed
          } else if (mimetype.startsWith('audio')) {
            try {
              const durationSec = await getMediaDuration(fileObj.path);
              if (durationSec != null) p.duration = durationSec;
            } catch (e) {
              console.error('Erreur extraction durée audio:', e);
            }
          }

          // Finally upload the media file itself (uploadFile will unlink the local file)
          try {
            const secureUrl = await uploadFile(fileObj.path);
            p.url = secureUrl;
          } catch (err) {
            console.error('upload media failed for', fileObj.path, err);
            return res.status(500).json({ message: 'Échec upload média.' });
          }
        } else {
          // part with no fileIndex: ensure text is present for text parts
          if ((p.type === 'text' || !p.type) && (p.text === undefined || p.text === null)) {
            // allow empty text? enforce minimal
            p.text = p.text || '';
          }
        }
      } // end for parts

      // Build actu document
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h by default
      const recipients = Array.isArray(recipientIds) ? recipientIds : JSON.parse(recipientIds);

      const newActu = new Actu({
        parts: partsPayload.map(p => ({
          type: p.type,
          url: p.url || null,
          text: p.text || null,
          duration: p.duration || null,
          thumbnailUrl: p.thumbnailUrl || null,
        })),
        owner,
        recipients,
        expiresAt,
      });

      const saved = await newActu.save();

      // Fetch owner info
      let user = null;
      try {
        user = await User.findById(owner).select('name profileImage');
      } catch (e) {
        // ignore, we'll still return actu
      }

      const createdActu = {
        _id: saved._id,
        owner: saved.owner,
        ownerName: user ? user.name : null,
        ownerProfileImage: user ? user.profileImage : null,
        parts: saved.parts,
        expiresAt: saved.expiresAt,
        createdAt: saved.createdAt,
      };

      // Emit socket.io event to recipients (assumes clients joined rooms with their userId)
      try {
        if (Array.isArray(recipients) && recipients.length > 0) {
          recipients.forEach(rId => {
            try {
              io.to(String(rId)).emit('actu_created', createdActu);
            } catch (err) {
              console.error('Socket emit error for recipient', rId, err);
            }
          });
        }
      } catch (err) {
        console.error('Socket emission error:', err);
      }

      return res.status(201).json(createdActu);
    } catch (err) {
      console.error('createActu error:', err);
      return res.status(500).json({ error: 'Impossible de créer l’actu.' });
    }
  };

  /**
   * GET /api/actu/received/:userId
   * Returns list of actus where the user is a recipient and not expired.
   * Returns parts array so client can render ActuContent.parts directly.
   */
  const getReceivedActus = async (req, res) => {
    try {
      const userId = req.params.userId;
      if (!userId) return res.status(400).json({ message: 'User ID requis.' });

      const actus = await Actu.find({
        recipients: { $in: [userId] },
        expiresAt: { $gt: new Date() },
        isActive: true
      })
        .sort({ createdAt: -1 })
        .populate('owner', 'name profileImage')
        .lean();

      const formattedActus = actus.map(actu => ({
        _id: actu._id,
        owner: actu.owner._id,
        ownerName: actu.owner.name,
        ownerProfileImage: actu.owner.profileImage,
        parts: actu.parts,
        expiresAt: actu.expiresAt,
        createdAt: actu.createdAt,
      }));

      return res.json(formattedActus);
    } catch (err) {
      console.error('getReceivedActus error:', err);
      return res.status(500).json({ error: 'Impossible de récupérer les actus.' });
    }
  };

  /**
   * POST /api/actu/mark-read
   * Body: { actuId, userId }
   */
  const markActuAsRead = async (req, res) => {
    try {
      const { actuId, userId } = req.body;
      if (!actuId || !userId) return res.status(400).json({ message: 'actuId et userId requis.' });

      const updatedActu = await Actu.findByIdAndUpdate(
        actuId,
        { $addToSet: { views: { viewerId: userId, viewedAt: new Date() } } },
        { new: true }
      );

      if (!updatedActu) return res.status(404).json({ message: 'Actu non trouvée.' });

      return res.status(200).json({ message: 'Actu marquée comme lue.' });
    } catch (err) {
      console.error('markActuAsRead error:', err);
      return res.status(500).json({ error: 'Impossible de marquer l\'actu comme lue.' });
    }
  };

  return {
    createActu,
    getReceivedActus,
    markActuAsRead,
  };
};
