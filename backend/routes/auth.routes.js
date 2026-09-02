const express = require('express');
const AuthController = require('../controllers/AuthController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', AuthController.register);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/test/fail-next', AuthController.armTestFailure);
router.post('/logout', requireAuth, AuthController.logout);

module.exports = router;