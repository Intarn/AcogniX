const express = require('express');
const AuthController = require('../controllers/AuthController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', requireAuth, AuthController.logout);

module.exports = router;