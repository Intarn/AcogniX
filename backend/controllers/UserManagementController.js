const UserManagementService = require('../service/UserManagementService');

class UserManagementController {

  // Basic Flow #1-2 (UC-12)
  static async search(req, res) {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Please provide a search term (name or email)." });
    }
    try {
      const users = await UserManagementService.searchAccounts(query);
      return res.status(200).json({ users });
    } catch (error) {
      return res.status(500).json({ message: "Unable to search accounts. Please try again." });
    }
  }

  // Basic Flow #3-4 (UC-12)
  static async resetPassword(req, res) {
    const { userId } = req.params;
    try {
      await UserManagementService.resetPassword(userId);
      return res.status(200).json({ message: "Password has been reset and emailed to the user." });
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(500).json({ message: "Unable to reset password. Please try again." });
    }
  }

  // Basic Flow #3-4 (UC-12)
  static async ban(req, res) {
    const { userId } = req.params;
    try {
      await UserManagementService.banAccount(userId);
      return res.status(200).json({ message: "Account has been banned." });
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(500).json({ message: "Unable to ban account. Please try again." });
    }
  }

  // Basic Flow #3-4 (UC-12)
  static async unban(req, res) {
    const { userId } = req.params;
    try {
      await UserManagementService.unbanAccount(userId);
      return res.status(200).json({ message: "Account has been unbanned." });
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(500).json({ message: "Unable to unban account. Please try again." });
    }
  }

  // Basic Flow #3-4 (UC-12)
  static async assignRole(req, res) {
    const { userId } = req.params;
    const { role } = req.body;
    try {
      await UserManagementService.assignRole(userId, role);
      return res.status(200).json({ message: "Role has been updated." });
    } catch (error) {
      if (error.message === 'INVALID_ROLE') {
        return res.status(400).json({ message: "Please select a valid role." });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(500).json({ message: "Unable to update role. Please try again." });
    }
  }

  // Alt Flow 1 (UC-12), step 1: request a 2FA code before deleting
  static async requestDeletion(req, res) {
    const { userId } = req.params;
    const adminUserId = req.user.userId;
    const adminEmail = req.user.email;

    try {
      await UserManagementService.requestAccountDeletion(adminUserId, adminEmail, userId);
      return res.status(200).json({ message: "A verification code has been sent to your email. Enter it to confirm deletion." });
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(500).json({ message: "Unable to send verification code. Please try again." });
    }
  }

  // Alt Flow 1 (UC-12), step 2: confirm deletion with the 2FA code
  static async confirmDeletion(req, res) {
    const { userId } = req.params;
    const { code } = req.body;
    const adminUserId = req.user.userId;

    if (!code) {
      return res.status(400).json({ message: "Please enter the verification code sent to your email." });
    }

    try {
      await UserManagementService.confirmAccountDeletion(adminUserId, userId, code);
      return res.status(200).json({ message: "Account has been permanently deleted." });
    } catch (error) {
      if (error.message === 'INVALID_TWO_FACTOR_CODE' || error.message === 'TWO_FACTOR_CODE_EXPIRED') {
        return res.status(401).json({ message: "Invalid or expired verification code." });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(500).json({ message: "Unable to delete account. Please try again." });
    }
  }
}

module.exports = UserManagementController;