const express = require('express');
const multer = require('multer');
const ProfileController = require('../controllers/ProfileController');
const { requireAuth } = require('../middleware/authMiddleware');

// Alt Flow 1 (UC-21): reject files over 5MB before they even reach the controller
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

router.use(requireAuth);

router.get('/', ProfileController.getProfile);
router.put('/', upload.single('avatar'), ProfileController.updateProfile);
// Thêm route PATCH để chỉ cập nhật thông tin dạng text (displayName)
router.patch('/', ProfileController.update);

module.exports = router;