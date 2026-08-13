const SupportTicketService = require('../service/SupportTicketService');

class SupportTicketController {
  // USER (LEARNER / EDUCATOR)
  static async create(req, res) {
    try {
      const userId = req.user.userId;
      const { subject, description } = req.body;
      const ticket = await SupportTicketService.createTicket(userId, { subject, description });
      return res.status(201).json({ message: "Support ticket created successfully.", ticket });
    } catch (error) {
      if (error.message === 'MISSING_REQUIRED_FIELDS') {
        return res.status(400).json({ message: "Subject and description are required." });
      }
      return res.status(500).json({ message: "Unable to create support ticket." });
    }
  }

  static async listMyTickets(req, res) {
    try {
      const userId = req.user.userId;
      const tickets = await SupportTicketService.getTicketsByUser(userId);
      return res.status(200).json({ tickets });
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch your tickets." });
    }
  }

  // ADMIN
  static async adminListAll(req, res) {
    try {
      const statusFilter = req.query.status || 'ALL';
      const tickets = await SupportTicketService.getAllTicketsForAdmin(statusFilter);
      return res.status(200).json({ tickets });
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch system tickets." });
    }
  }

  static async adminUpdateStatus(req, res) {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;
      const result = await SupportTicketService.updateTicketStatus(ticketId, status);

      return res.status(200).json({
        message: result.notificationSent
          ? "Ticket status updated and user notified."
          : "Ticket status updated. User notification could not be sent.",
        ticket: result.ticket,
        notificationSent: result.notificationSent
      });
    } catch (error) {
      if (error.message === 'INVALID_STATUS') {
        return res.status(400).json({
          message: "Invalid status. Use OPEN, RESOLVED, or CLOSED."
        });
      }

      if (error.message === 'INVALID_STATUS_TRANSITION') {
        return res.status(400).json({
          message: "Invalid status transition. Resolved and Closed tickets can only be reopened."
        });
      }

      if (error.message === 'TICKET_NOT_FOUND') {
        return res.status(404).json({ message: "Support ticket not found." });
      }

      return res.status(500).json({ message: "Unable to update ticket status." });
    }
  }

  static async getTotalTickets(req, res) {
    try {
      const total = await SupportTicketService.getTotalTickets();
      return res.status(200).json({ totalTickets: total });
    } catch (error) {
      return res.status(500).json({ message: "Unable to count tickets." });
    }
  }
}

module.exports = SupportTicketController;
