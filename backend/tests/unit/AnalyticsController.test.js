jest.mock('../../service/AnalyticsService', () => ({
  recordStudyPing: jest.fn(),
  getPersonalStats: jest.fn(),
  getClassPerformance: jest.fn()
}));

const AnalyticsController = require('../../controllers/AnalyticsController');
const AnalyticsService = require('../../service/AnalyticsService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AnalyticsController unit tests', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => consoleErrorSpy.mockRestore());
  beforeEach(() => jest.clearAllMocks());

  test('pingSession() calls Service, emits socket event and returns 200', async () => {
    const mockEmit = jest.fn();
    const req = {
      body: { courseId: 'c-1' },
      user: { userId: 'u-1' },
      app: { get: jest.fn().mockReturnValue({ emit: mockEmit }) }
    };
    const res = mockRes();
    AnalyticsService.recordStudyPing.mockResolvedValue({ status: 'extended', durationMinutes: 5 });

    await AnalyticsController.pingSession(req, res);

    expect(AnalyticsService.recordStudyPing).toHaveBeenCalledWith('u-1', 'c-1');
    expect(req.app.get).toHaveBeenCalledWith('io');
    expect(mockEmit).toHaveBeenCalledWith('study_ping_updated', expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Study time tracked successfully.',
      data: { status: 'extended', durationMinutes: 5 }
    });
  });

  test('getPersonalStats() returns 200 and stats', async () => {
    const req = { user: { userId: 'u-1' } };
    const res = mockRes();
    const mockStats = { totalStudyMinutes: 120, totalStudyHours: "2.0" };
    AnalyticsService.getPersonalStats.mockResolvedValue(mockStats);

    await AnalyticsController.getPersonalStats(req, res);

    expect(AnalyticsService.getPersonalStats).toHaveBeenCalledWith('u-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockStats);
  });

  test('getClassPerformance() returns 200 and performance data', async () => {
    const req = { params: { courseId: 'c-1' }, user: { userId: 'e-1' } };
    const res = mockRes();
    const mockData = { classAverageScore: 85.5, atRiskStudents: [] };
    AnalyticsService.getClassPerformance.mockResolvedValue(mockData);

    await AnalyticsController.getClassPerformance(req, res);

    expect(AnalyticsService.getClassPerformance).toHaveBeenCalledWith('c-1', 'e-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockData);
  });

  test('Controllers map errors properly to 500', async () => {
    AnalyticsService.getPersonalStats.mockRejectedValue(new Error('DB Error'));
    const req = { user: { userId: 'u-1' } };
    const res = mockRes();

    await AnalyticsController.getPersonalStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.'
    });
  });
});