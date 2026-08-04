const ProfileService = require('../service/ProfileService');

class ProfileController {

  // Basic Flow #1-2 (UC-21)
  static async getProfile(req, res) {
    const userId = req.user.userId;
    try {
      const result = await ProfileService.getProfile(userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "Unable to load profile. Please try again." });
    }
  }

  // Basic Flow #5-6 / Alt Flow 1 (UC-21)
  static async updateProfile(req, res) {
    const userId = req.user.userId;
    const { displayName } = req.body;
    const avatarFile = req.file; // populated by multer

    try {
      const updated = await ProfileService.updateProfile(userId, { displayName, avatarFile });
      return res.status(200).json({ message: "Profile updated successfully.", profile: updated });
    } catch (error) {
      if (error.message === 'DISPLAY_NAME_REQUIRED') {
        return res.status(400).json({ message: "Display name cannot be empty." });
      }
      if (error.message === 'AVATAR_TOO_LARGE') {
        return res.status(400).json({ message: "File size exceeds the maximum limit of 5MB." });
      }
      return res.status(500).json({ message: "Unable to update profile. Please try again." });
    }
  }
}

module.exports = ProfileController;