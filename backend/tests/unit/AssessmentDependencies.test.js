const NotificationService = require('../../service/NotificationService');
const AssessmentAnalyticsIntegrationService = require('../../service/AssessmentAnalyticsIntegrationService');

describe('UC-09/UC-10 integration-boundary contracts', () => {
  test('NotificationService exposes notifyAssessmentChanged()', () => {
    expect(typeof NotificationService.notifyAssessmentChanged).toBe('function');
  });

  test('AssessmentAnalyticsIntegrationService exposes recordAssessmentScore()', () => {
    expect(typeof AssessmentAnalyticsIntegrationService.recordAssessmentScore).toBe('function');
  });

  test('recordAssessmentScore() placeholder returns an explicit not-implemented result', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = await AssessmentAnalyticsIntegrationService.recordAssessmentScore({
      learnerId: 'l-1',
      courseId: 'c-1',
      assessmentId: 'a-1',
      score: 8
    });
    expect(result).toEqual({
      recorded: false,
      reason: 'ANALYTICS_SERVICE_NOT_IMPLEMENTED'
    });
    logSpy.mockRestore();
  });
});
