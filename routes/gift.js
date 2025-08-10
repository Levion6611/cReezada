/* server/routes/gift.js */
const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const { createGift, getReceivedGifts, likeGift, dislikeGift, markGiftAsRead,  } = require('../controllers/giftController');

router.post('/', upload.single('file'), createGift);
router.get('/received/:userId', getReceivedGifts);
router.post('/:id/like', likeGift);
router.post('/:id/dislike', dislikeGift);
router.post('/:id/read', markGiftAsRead);

module.exports = router;
