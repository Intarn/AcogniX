const express = require('express');
const SupportTicketController = require('../controllers/SupportTicketController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth); 

router.post('/tickets', SupportTicketController.create);
router.get('/tickets', SupportTicketController.listMyTickets);

module.exports = router;