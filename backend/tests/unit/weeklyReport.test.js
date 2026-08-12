jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));
jest.mock('../../config/supabaseClient', () => ({
  from: jest.fn()
}));
jest.mock('../../service/AnalyticsService', () => ({
  getClassPerformance: jest.fn()
}));
jest.mock('../../service/EmailService', () => ({
  send: jest.fn()
}));

const cron = require('node-cron');
const supabase = require('../../config/supabaseClient');
const AnalyticsService = require('../../service/AnalyticsService');
const EmailService = require('../../service/EmailService');
const scheduleWeeklyReports = require('../../cron/weeklyReport');

describe('Cron Job: scheduleWeeklyReports unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production'; // Pass the environment guard
  });

  test('Registers cron schedule correctly', () => {
    scheduleWeeklyReports();
    expect(cron.schedule).toHaveBeenCalledWith('59 23 * * 0', expect.any(Function));
  });

  test('Cron callback handles per-course errors without crashing', async () => {
    scheduleWeeklyReports();
    const cronCallback = cron.schedule.mock.calls[0][1];

    // Mock 2 courses
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { email: 'educator@test.com' } })
    });
    // Return mock courses from the first query
    supabase.from().eq.mockResolvedValueOnce({ 
      data: [{ courseId: 'c-1', subjectName: 'Math' }, { courseId: 'c-2', subjectName: 'Science' }] 
    });

    // Make the first course throw an error, second course succeed
    AnalyticsService.getClassPerformance
      .mockRejectedValueOnce(new Error('Course 1 failed'))
      .mockResolvedValueOnce({ classAverageScore: 80, atRiskStudents: [] });

    EmailService.send.mockResolvedValue(true);

    await cronCallback();

    // Ensure Email was sent for course 2 despite course 1 failing
    expect(AnalyticsService.getClassPerformance).toHaveBeenCalledTimes(2);
    expect(EmailService.send).toHaveBeenCalledTimes(1); 
    expect(EmailService.send).toHaveBeenCalledWith('educator@test.com', 'Weekly Report: Science', expect.any(String));
  });
});