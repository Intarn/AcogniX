const supabase = require('../config/supabaseClient');
const EmailService = require('./EmailService');

const VALID_STATUSES = ['OPEN', 'RESOLVED', 'CLOSED'];

class SupportTicketService {
  static async createTicket(userId, { subject, description }) {
    if (!subject || !description) {
      const err = new Error('MISSING_REQUIRED_FIELDS');
      err.status = 400;
      throw err;
    }

    const { data, error } = await supabase
      .from('Support_Ticket')
      .insert([{ userId, subject, description, status: 'OPEN' }])
      .select()
      .single();

    if (error) {
      const err = new Error('CREATE_TICKET_FAILED');
      err.status = 500;
      throw err;
    }
    return data;
  }

  static async getTicketsByUser(userId) {
    const { data, error } = await supabase
      .from('Support_Ticket')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      const err = new Error('FETCH_TICKETS_FAILED');
      err.status = 500;
      throw err;
    }
    return data || [];
  }

  static async getAllTicketsForAdmin(statusFilter = '') {
    let query = supabase
      .from('Support_Ticket')
      .select('*, User(email, displayName)')
      .order('createdAt', { ascending: false });

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      const err = new Error('ADMIN_FETCH_TICKETS_FAILED');
      err.status = 500;
      throw err;
    }
    return data || [];
  }

  static isValidTransition(currentStatus, nextStatus) {
    if (!VALID_STATUSES.includes(currentStatus) || !VALID_STATUSES.includes(nextStatus)) {
      return false;
    }

    // Status changes intentionally stay reversible from resolved/closed back to open.
    // This protects admins from permanently getting a ticket stuck because of a misclick.
    const allowed = {
      OPEN: ['OPEN', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['RESOLVED', 'OPEN'],
      CLOSED: ['CLOSED', 'OPEN']
    };

    return allowed[currentStatus].includes(nextStatus);
  }

  static async updateTicketStatus(ticketId, status) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error('INVALID_STATUS');
      err.status = 400;
      throw err;
    }

    const { data: currentTicket, error: fetchError } = await supabase
      .from('Support_Ticket')
      .select('ticketId, userId, subject, description, status')
      .eq('ticketId', ticketId)
      .single();

    if (fetchError || !currentTicket) {
      const err = new Error('TICKET_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    if (!this.isValidTransition(currentTicket.status, status)) {
      const err = new Error('INVALID_STATUS_TRANSITION');
      err.status = 400;
      throw err;
    }

    // No-op requests are safe and idempotent.
    if (currentTicket.status === status) {
      return {
        ticket: currentTicket,
        notificationSent: false,
        notificationError: null
      };
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('Support_Ticket')
      .update({ status, updatedAt: new Date() })
      .eq('ticketId', ticketId)
      .select()
      .single();

    if (updateError || !updatedTicket) {
      const err = new Error('UPDATE_TICKET_FAILED');
      err.status = 500;
      throw err;
    }

    // Email notification is deliberately best-effort: a mail server failure must not
    // make a successful database update look like a failed ticket update.
    let notificationSent = false;
    let notificationError = null;

    try {
      const { data: user, error: userError } = await supabase
        .from('User')
        .select('email, displayName')
        .eq('userId', currentTicket.userId)
        .single();

      if (userError || !user?.email) {
        throw new Error('TICKET_USER_EMAIL_NOT_FOUND');
      }

      await EmailService.sendSupportTicketStatusChanged(
        user.email,
        user.displayName,
        {
          ticketId: updatedTicket.ticketId,
          subject: updatedTicket.subject,
          description: updatedTicket.description,
          previousStatus: currentTicket.status,
          newStatus: updatedTicket.status
        }
      );

      notificationSent = true;
    } catch (emailError) {
      notificationError = emailError.message || 'EMAIL_SEND_FAILED';
      console.error(
        `Support ticket ${ticketId} status updated to ${status}, but user notification failed:`,
        emailError
      );
    }

    return {
      ticket: updatedTicket,
      notificationSent,
      notificationError
    };
  }

  static async getTotalTickets() {
    const { count, error } = await supabase
      .from('Support_Ticket')
      .select('*', { count: 'exact', head: true });

    if (error) {
      const err = new Error('COUNT_FAILED');
      err.status = 500;
      throw err;
    }
    return count || 0;
  }
}

module.exports = SupportTicketService;
