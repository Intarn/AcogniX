const supabase = require('../config/supabaseClient');
const { UserRole } = require('../enums/AuthEnums');

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // Alt Flow 1 (UC-21)
const AVATAR_BUCKET = 'avatars';

class ProfileService {

  // Basic Flow #1-2 (UC-21)
  static async getProfile(userId) {
    const { data: profile, error } = await supabase
      .from('User')
      .select('userId, email, displayName, avatarUrl, role, status, createdAt')
      .eq('userId', userId)
      .single();

    if (error || !profile) {
      const err = new Error('PROFILE_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    // Alt Flow 3 (UC-21): Learner-only aggregate learning dashboard
    let learningSummary = null;
    if (profile.role === UserRole.LEARNER) {
      learningSummary = await this.getLearnerAggregateStats(userId);
    }

    return { profile, learningSummary };
  }

  // Alt Flow 3 (UC-21): all-time aggregate metrics across all enrolled classes.
  // DEPENDENCY: relies on tables owned by the Learning Tracking and Analytics /
  // AI Workspace components (study sessions, AI interactions, flashcards),
  // which are not created in this migration yet. Degrades gracefully to zeros
  // until a "get_learner_aggregate_stats" RPC function is added in Supabase.
  static async getLearnerAggregateStats(userId) {
    try {
      const { data, error } = await supabase.rpc('get_learner_aggregate_stats', { p_user_id: userId });
      if (error) throw error;
      return data;
    } catch (e) {
      return { totalActiveStudyHours: 0, totalAiInteractions: 0, totalFlashcardsCreated: 0 };
    }
  }

  // Basic Flow #5-6 / Alt Flow 1 (UC-21)
  static async updateProfile(userId, { displayName, avatarFile }) {
    const updates = { updatedAt: new Date() };

    if (displayName !== undefined) {
      // Alt Flow 1 (UC-21): reject blank display name
      if (!displayName || !displayName.trim()) {
        const err = new Error('DISPLAY_NAME_REQUIRED');
        err.status = 400;
        throw err;
      }
      updates.displayName = displayName.trim();
    }

    if (avatarFile) {
      // Alt Flow 1 (UC-21): 5MB size limit
      if (avatarFile.size > AVATAR_MAX_SIZE_BYTES) {
        const err = new Error('AVATAR_TOO_LARGE');
        err.status = 400;
        throw err;
      }

      const fileExt = avatarFile.originalname.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, avatarFile.buffer, { contentType: avatarFile.mimetype, upsert: true });

      if (uploadError) {
        const err = new Error('AVATAR_UPLOAD_FAILED');
        err.status = 500;
        throw err;
      }

      const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
      updates.avatarUrl = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from('User')
      .update(updates)
      .eq('userId', userId)
      .select('userId, email, displayName, avatarUrl, role, status')
      .single();

    if (error) {
      const err = new Error('PROFILE_UPDATE_FAILED');
      err.status = 500;
      throw err;
    }

    return data;
  }
}

module.exports = ProfileService;