/* server/routes/post.js */
const express = require('express');
const router  = express.Router();
const multer  = require('../middleware/upload');
const postCtrl = require('../controllers/postController');

// Accept multiple files under field name 'files'
router.post('/', multer.array('files', 5), postCtrl.createPost);
router.get('/received/:userId', postCtrl.getReceivedPosts);

module.exports = router;
