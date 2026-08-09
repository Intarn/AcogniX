const ProfileService = require('../service/ProfileService');
const AppError = require('../error/AppError');

class ProfileController {
    static async getProfile(req, res) {
        try {
            const userId = req.user.userId;
            const profile = await ProfileService.getProfile(userId);
            return res.status(200).json({ profile });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ code: error.code, message: error.message });
            }
            console.error('Get Profile Controller Error:', error);
            return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred while fetching the profile.' });
        }
    }

    static async updateProfile(req, res) {
        // This is a placeholder for the PUT request which includes avatar upload.
        // The full implementation for file handling is not yet in ProfileService.
        return res.status(501).json({ 
            code: 'NOT_IMPLEMENTED', 
            message: 'Full profile update including avatar is not implemented yet. Use PATCH to update display name.' 
        });
    }

    static async update(req, res) {
        try {
            const userId = req.user.userId;
            const { displayName } = req.body;

            const updatedUser = await ProfileService.updateProfile(userId, { displayName });

            return res.status(200).json({
                message: 'Profile updated successfully.',
                user: updatedUser
            });

        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ code: error.code, message: error.message });
            }
            console.error('Profile Controller Error:', error);
            return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred while updating the profile.' });
        }
    }
}

module.exports = ProfileController;