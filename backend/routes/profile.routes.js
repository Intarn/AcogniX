// backend/routes/profile.routes.js
const express = require('express');
const multer = require('multer');
const ProfileController = require('../controllers/ProfileController');
const { requireAuth } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

router.use(requireAuth);

router.get('/', ProfileController.getProfile);
router.put('/', upload.single('avatar'), ProfileController.updateProfile);
router.put('/password', ProfileController.changePassword);

module.exports = router;