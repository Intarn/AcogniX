const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/ProfileController');
const authMiddleware = require('../middleware/authMiddleware'); // Giả định bạn có file middleware này

// Route để cập nhật thông tin cá nhân (tên hiển thị)
// PATCH /api/profile
router.patch('/', authMiddleware, ProfileController.update);

module.exports = router;