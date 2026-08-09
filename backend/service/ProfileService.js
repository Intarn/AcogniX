const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class ProfileService {
    static async getProfile(userId) {
        const { data, error } = await supabase
            .from('User')
            .select('userId, email, displayName, role, avatarUrl, createdAt')
            .eq('userId', userId)
            .single();

        if (error) {
            console.error('Supabase Get Profile Error:', error);
            throw new AppError(500, 'PROFILE_FETCH_FAILED', 'Could not retrieve profile from the database.');
        }

        if (!data) {
            throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
        }

        return data;
    }

    static async updateProfile(userId, { displayName }) {
        if (!displayName || displayName.trim().length === 0) {
            throw new AppError(400, 'DISPLAY_NAME_REQUIRED', 'Display name cannot be empty.');
        }

        const { data, error } = await supabase
            .from('User')
            .update({ displayName: displayName.trim() })
            .eq('userId', userId)
            .select()
            .single();

        if (error) {
            console.error('Supabase Profile Update Error:', error);
            throw new AppError(500, 'PROFILE_UPDATE_FAILED', 'Could not update profile in the database.');
        }

        if (!data) {
            throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
        }

        return {
            userId: data.userId,
            displayName: data.displayName,
            email: data.email,
            role: data.role
        };
    }
}

module.exports = ProfileService;