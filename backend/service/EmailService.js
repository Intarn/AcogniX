const transporter = require('../config/emailClient');

class EmailService {

  // Send an email to one recipient
  static async send(to, subject, html) {
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