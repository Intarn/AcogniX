const supabase = require('../config/supabaseClient');

class AssessmentAnalyticsIntegrationService {
  /**
   * UC10 Post-condition:
   * Submission.score is the source of truth for Personal Statistics. This
   * integration verifies that the just-graded score is already persisted and
   * therefore immediately visible to AnalyticsService without creating a
   * second analytics copy that could become duplicated or inconsistent.
   */
  static async recordAssessmentScore({ learnerId, courseId, assessmentId, score }) {
    try {
      const { data, error } = await supabase
        .from('Submission')
        .select('submissionId, learnerId, assessmentId, score, status, Assessment!inner(courseId)')
        .eq('learnerId', learnerId)
        .eq('assessmentId', assessmentId)
        .eq('status', 'GRADED')
        .maybeSingle();

      if (error) throw error;

      const persistedScore = Number(data?.score);
      const expectedScore = Number(score);
      const recorded = Boolean(
        data &&
        String(data.learnerId) === String(learnerId) &&
        String(data.Assessment?.courseId) === String(courseId) &&
        Number.isFinite(persistedScore) &&
        Number.isFinite(expectedScore) &&
        persistedScore === expectedScore
      );

      return {
        recorded,
        source: 'Submission',
        submissionId: data?.submissionId || null,
        learnerId,
        courseId,
        assessmentId,
        score: recorded ? persistedScore : expectedScore
      };
    } catch (error) {
      // The submission itself has already been committed. AnalyticsService
      // reads directly from Submission, so an integration verification error
      // must not turn a successful learner submission into a false failure.
      console.error('[Analytics Integration] Unable to verify persisted score:', error);
      return {
        recorded: false,
        source: 'Submission',
        reason: 'VERIFICATION_FAILED',
        learnerId,
        courseId,
        assessmentId,
        score: Number(score)
      };
    }
  }
}

module.exports = AssessmentAnalyticsIntegrationService;
