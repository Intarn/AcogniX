const supabase = require('../config/supabaseClient');
const { UserRole } = require('../enums/AuthEnums');

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_BUCKET = 'avatars';

class ProfileService {
  // UC19 Basic Flow: view the current authenticated User's profile.
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

    // UC19 Alternative Flow 3: only Learners receive the compact all-time
    // learning summary. Educator profile responses keep this field null.
    let learningSummary = null;
    if (profile.role === UserRole.LEARNER) {
      learningSummary = await this.getLearnerAggregateStats(userId);
    }

    return { profile, learningSummary };
  }

  // UC19 UI02: calculate the three all-time metrics from the existing
  // AcogniX tables instead of depending on an optional RPC function.
  static async getLearnerAggregateStats(userId) {
    const [sessionsResult, workspaceResult] = await Promise.all([
      supabase
        .from('Study_Session')
        .select('startTime, endTime, durationMinutes')
        .eq('learnerId', userId),
      supabase
        .from('AI_Workspace')
        .select('workspaceId')
        .eq('learnerId', userId)
        .maybeSingle()
    ]);

    if (sessionsResult.error) throw sessionsResult.error;
    if (workspaceResult.error) throw workspaceResult.error;

    const totalStudyMilliseconds = this._calculateUniqueStudyMilliseconds(
      sessionsResult.data || []
    );

    let totalAiInteractions = 0;
    let totalFlashcardsCreated = 0;

    const workspaceId = workspaceResult.data?.workspaceId;
    if (workspaceId) {
      const { data: projects, error: projectError } = await supabase
        .from('AI_Project')
        .select('projectId')
        .eq('workspaceId', workspaceId);

      if (projectError) throw projectError;

      const projectIds = (projects || [])
        .map((project) => project.projectId)
        .filter(Boolean);

      if (projectIds.length > 0) {
        // Fetch only identifiers first. Avoid the nested Flashcard relationship
        // payload here: on larger histories PostgREST may spend a long time
        // materializing every flashcard row just to calculate a count.
        const [conversationResult, flashcardSetResult] = await Promise.all([
          supabase
            .from('Conversation')
            .select('conversationId')
            .in('projectId', projectIds),
          supabase
            .from('Flashcard_Set')
            .select('flashcardSetId')
            .in('projectId', projectIds)
        ]);

        if (conversationResult.error) throw conversationResult.error;
        if (flashcardSetResult.error) throw flashcardSetResult.error;

        const conversationIds = (conversationResult.data || [])
          .map((conversation) => conversation.conversationId)
          .filter(Boolean);
        const flashcardSetIds = (flashcardSetResult.data || [])
          .map((set) => set.flashcardSetId)
          .filter(Boolean);

        const countPromises = [];
        if (conversationIds.length > 0) {
          countPromises.push(
            supabase
              .from('Chat_Message')
              .select('messageId', { count: 'exact', head: true })
              .in('conversationId', conversationIds)
              .eq('senderRole', 'AI_TUTOR')
              .then(({ count, error }) => {
                if (error) throw error;
                totalAiInteractions = Number(count || 0);
              })
          );
        }

        if (flashcardSetIds.length > 0) {
          countPromises.push(
            supabase
              .from('Flashcard')
              .select('flashcardId', { count: 'exact', head: true })
              .in('flashcardSetId', flashcardSetIds)
              .then(({ count, error }) => {
                if (error) throw error;
                totalFlashcardsCreated = Number(count || 0);
              })
          );
        }

        await Promise.all(countPromises);
      }
    }

    return {
      totalActiveStudyHours: Number((totalStudyMilliseconds / 3_600_000).toFixed(2)),
      totalAiInteractions,
      totalFlashcardsCreated
    };
  }

  // Merge overlapping Study_Session intervals so the profile summary follows
  // the same no-double-count rule introduced for UC03.
  static _calculateUniqueStudyMilliseconds(sessions = []) {
    const intervals = (sessions || [])
      .map((session) => {
        const start = new Date(session.startTime);
        if (Number.isNaN(start.getTime())) return null;

        let end = new Date(session.endTime);
        if (Number.isNaN(end.getTime())) {
          const durationMinutes = Math.max(0, Number(session.durationMinutes || 0));
          end = new Date(start.getTime() + durationMinutes * 60_000);
        }

        if (end <= start) return null;
        return [start.getTime(), end.getTime()];
      })
      .filter(Boolean)
      .sort((a, b) => a[0] - b[0]);

    if (intervals.length === 0) return 0;

    let total = 0;
    let [currentStart, currentEnd] = intervals[0];

    for (let i = 1; i < intervals.length; i += 1) {
      const [nextStart, nextEnd] = intervals[i];
      if (nextStart <= currentEnd) {
        currentEnd = Math.max(currentEnd, nextEnd);
      } else {
        total += currentEnd - currentStart;
        currentStart = nextStart;
        currentEnd = nextEnd;
      }
    }

    return total + (currentEnd - currentStart);
  }

  // UC19 Basic Flow / Alternative Flow 1.
  static async updateProfile(userId, { displayName, avatarFile }) {
    const updates = { updatedAt: new Date() };

    if (displayName !== undefined) {
      if (!displayName || !displayName.trim()) {
        const err = new Error('DISPLAY_NAME_REQUIRED');
        err.status = 400;
        throw err;
      }
      updates.displayName = displayName.trim();
    }

    if (avatarFile) {
      if (avatarFile.size > AVATAR_MAX_SIZE_BYTES) {
        const err = new Error('AVATAR_TOO_LARGE');
        err.status = 400;
        throw err;
      }

      const fileExt = avatarFile.originalname.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, avatarFile.buffer, {
          contentType: avatarFile.mimetype,
          upsert: true
        });

      if (uploadError) {
        const err = new Error('AVATAR_UPLOAD_FAILED');
        err.status = 500;
        throw err;
      }

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      // The storage path is intentionally stable. Persist a version query so
      // browsers do not keep showing the previous cached avatar after update.
      updates.avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
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
