const transporter = require('../config/emailClient');

class EmailService {

  static async send(to, subject, html) {
    await transporter.sendMail({
      from: `"AcogniX" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
  }

  static async sendTwoFactorCode(to, code) {
    await this.send(
      to,
      "AcogniX - Account Deletion Verification Code",
      `<p>Your verification code is: <b style="font-size:20px">${code}</b></p>
       <p>This code expires in 5 minutes. If you did not request this, you can safely ignore this email.</p>`
    );
  }

  // Basic Flow #4 (UC-12): automatic notification after Ban
  static async sendAccountBanned(to) {
    await this.send(
      to,
      "AcogniX - Account Suspended",
      `<p>Your AcogniX account has been suspended by a System Administrator.</p>
       <p>If you believe this is a mistake, please contact support.</p>`
    );
  }

  // Basic Flow #4 (UC-12): automatic notification after Unban
  static async sendAccountUnbanned(to) {
    await this.send(
      to,
      "AcogniX - Account Reactivated",
      `<p>Your AcogniX account has been reactivated. You can now log in normally.</p>`
    );
  }

  // Basic Flow #4 (UC-12): automatic notification after role assignment
  static async sendRoleChanged(to, newRole) {
    await this.send(
      to,
      "AcogniX - Account Role Updated",
      `<p>Your account role has been updated to <b>${newRole}</b> by a System Administrator.</p>`
    );
  }

  // Basic Flow #4 (UC-12): automatic notification after password reset
  static async sendPasswordReset(to, tempPassword) {
    await this.send(
      to,
      "AcogniX - Password Reset",
      `<p>Your password has been reset by a System Administrator.</p>
       <p>Temporary password: <b>${tempPassword}</b></p>
       <p>Please log in and change your password immediately.</p>`
    );
  }

  static async sendAccountDeleted(to) {
    await this.send(
      to,
      "AcogniX - Account Deleted",
      `<p>Your AcogniX account has been permanently deleted by a System Administrator.</p>`
    );
  }
}

module.exports = EmailService;