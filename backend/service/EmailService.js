const transporter = require('../config/emailClient');
const AppError = require('../error/AppError');

let failNextDelivery = false;

class EmailService {
  static armNextDeliveryFailure() {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }
    failNextDelivery = true;
    return true;
  }

  static _throwIfTestFailureArmed() {
    if (!failNextDelivery) return;
    failNextDelivery = false;
    throw new Error('Simulated email delivery failure for test execution.');
  }


  // Send an email to one recipient
  static async send(to, subject, html) {
    this._throwIfTestFailureArmed();
    await transporter.sendMail({
      from: `"AcogniX" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
  }


  // Send the same email to multiple recipients.
  // BCC prevents recipients from seeing each other's email.
  static async sendBulk(emails, subject, html) {
    if (!emails || emails.length === 0) {
      return;
    }

    this._throwIfTestFailureArmed();
    await transporter.sendMail({
      from: `"AcogniX" <${process.env.EMAIL_USER}>`,
      bcc: emails,
      subject,
      html
    });
  }


  // 2FA is a security verification email,
  // not a business notification.
  static async sendTwoFactorCode(to, code) {
    await this.send(
      to,
      'AcogniX - Account Deletion Verification Code',
      `
        <p>
          Your verification code is:
          <b style="font-size:20px">${code}</b>
        </p>

        <p>
          This code expires in 5 minutes.
          If you did not request this,
          you can safely ignore this email.
        </p>
      `
    );
  }



  static async sendAccountBanned(to) {
    await this.send(
      to,
      'AcogniX - Account Suspended',
      `
        <p>
          Your AcogniX account has been suspended
          by a System Administrator.
        </p>

        <p>
          If you believe this is a mistake,
          please contact support.
        </p>
      `
    );
  }


  static async sendAccountUnbanned(to) {
    await this.send(
      to,
      'AcogniX - Account Reactivated',
      `
        <p>
          Your AcogniX account has been reactivated.
          You can now log in normally.
        </p>
      `
    );
  }


  static async sendRoleChanged(to, newRole) {
    await this.send(
      to,
      'AcogniX - Account Role Updated',
      `
        <p>
          Your account role has been updated to
          <b>${newRole}</b>
          by a System Administrator.
        </p>
      `
    );
  }


  static async sendForgotPassword(to, tempPassword) {
    const safePassword = EmailService.escapeHtml(tempPassword);
    await this.send(
      to,
      'AcogniX - Your New Password',
      `
        <p>We received a Forgot Password request for your AcogniX account.</p>
        <p>Your password has been changed by the system.</p>
        <p>New temporary password: <b>${safePassword}</b></p>
        <p>Please log in with this password and change it from your profile as soon as possible.</p>
        <p>If you did not request this change, please contact support immediately.</p>
      `
    );
  }


  static async sendPasswordReset(to, tempPassword) {
    await this.send(
      to,
      'AcogniX - Password Reset',
      `
        <p>
          Your password has been reset
          by a System Administrator.
        </p>

        <p>
          Temporary password:
          <b>${tempPassword}</b>
        </p>

        <p>
          Please log in and change your password
          immediately.
        </p>
      `
    );
  }



  static async sendSupportTicketStatusChanged(to, displayName, ticket) {
    const safeName = EmailService.escapeHtml(displayName || 'there');
    const safeTicketId = EmailService.escapeHtml(ticket.ticketId || 'N/A');
    const safeSubject = EmailService.escapeHtml(ticket.subject || 'Support ticket');
    const safeDescription = EmailService.escapeHtml(ticket.description || '').replace(/\r?\n/g, '<br>');
    const newStatus = EmailService.escapeHtml(ticket.newStatus || 'UPDATED');
    const previousStatus = EmailService.escapeHtml(ticket.previousStatus || '');

    let title = 'Your Support Ticket Has Been Updated';
    let message = 'The status of your support ticket has been updated by our support team.';

    if (ticket.newStatus === 'RESOLVED') {
      title = 'Your Support Ticket Has Been Resolved';
      message = 'Our support team has marked your support ticket as resolved.';
    } else if (ticket.newStatus === 'CLOSED') {
      title = 'Your Support Ticket Has Been Closed';
      message = 'Our support team has closed your support ticket.';
    } else if (ticket.newStatus === 'OPEN') {
      title = 'Your Support Ticket Has Been Reopened';
      message = 'Your support ticket has been reopened and is available for further support.';
    }

    await EmailService.send(
      to,
      `AcogniX - ${title}`,
      `
        <p>Hello ${safeName},</p>
        <p>${message}</p>

        <p>
          <b>Ticket:</b> #${safeTicketId}<br>
          <b>Subject:</b> ${safeSubject}<br>
          <b>Status:</b> ${previousStatus} &rarr; <b>${newStatus}</b>
        </p>

        <p>
          <b>Your request:</b><br>
          ${safeDescription}
        </p>

        <p>You can log in to AcogniX to review your support tickets.</p>
      `
    );
  }

  static escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  static async sendAccountDeleted(to) {
    await this.send(
      to,
      'AcogniX - Account Deleted',
      `
        <p>
          Your AcogniX account has been permanently
          deleted by a System Administrator.
        </p>
      `
    );
  }
}

module.exports = EmailService;