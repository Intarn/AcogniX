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

// UC19 UI05: convert Multer's size-limit exception into the same specific
// validation response used by ProfileService instead of leaking a generic 500.
router.put(
  '/',
  (req, res, next) => {
    upload.single('avatar')(req, res, (error) => {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File size exceeds the maximum limit of 5MB.',
          code: 'AVATAR_TOO_LARGE'
        });
      }
      if (error) return next(error);
      return next();
    });
  },
  ProfileController.updateProfile
);

router.put('/password', ProfileController.changePassword);

module.exports = router;
