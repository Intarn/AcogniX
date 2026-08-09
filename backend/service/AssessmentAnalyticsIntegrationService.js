class AssessmentAnalyticsIntegrationService {
  static async recordAssessmentScore({
    learnerId,
    courseId,
    assessmentId,
    score
  }) {
    console.log('[TODO Analytics] Assessment score', {
      learnerId,
      courseId,
      assessmentId,
      score
    });

    return {
      recorded: false,
      reason: 'ANALYTICS_SERVICE_NOT_IMPLEMENTED'
    };
  }
}

module.exports = AssessmentAnalyticsIntegrationService;
