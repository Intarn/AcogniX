jest.mock('../../config/supabaseClient', () => ({
  from: jest.fn()
}));

const supabase = require('../../config/supabaseClient');
const AnalyticsService = require('../../service/AnalyticsService');

function mockSupabaseChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
  };
}

describe('AnalyticsService unit tests', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.useRealTimers());

  describe('_calculateWeeklyTrend', () => {
    test('calculates correct 7-day trend array', () => {
      const today = new Date('2026-08-12T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(today);
      
      const twoDaysAgo = new Date('2026-08-10T00:00:00.000Z');
      const sessions = [{ startTime: twoDaysAgo.toISOString(), durationMinutes: 30 }];
      
      const trend = AnalyticsService._calculateWeeklyTrend(sessions);
      expect(trend).toHaveLength(7);
      expect(trend[4]).toBe(30); // index 6 is today, 4 is 2 days ago
    });
  });

  describe('recordStudyPing', () => {
    test('creates new session if no recent session exists', async () => {
      const insertMock = mockSupabaseChain({ data: { sessionId: 's-1' }, error: null });
      supabase.from.mockImplementation(() => insertMock);

      const result = await AnalyticsService.recordStudyPing('l-1', 'c-1');
      
      expect(insertMock.insert).toHaveBeenCalled();
      expect(result.status).toBe('created');
    });

    test('extends existing session if within 2 minutes (120000ms)', async () => {
      const now = new Date('2026-08-12T10:02:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      
      const recentSession = { 
        sessionId: 's-1', 
        startTime: '2026-08-12T10:00:00.000Z', 
        endTime: '2026-08-12T10:01:00.000Z' 
      };

      const chainMock = mockSupabaseChain({ data: recentSession, error: null });
      supabase.from.mockImplementation(() => chainMock);

      const result = await AnalyticsService.recordStudyPing('l-1', 'c-1');
      expect(chainMock.update).toHaveBeenCalledWith(expect.objectContaining({
        durationMinutes: 2
      }));
      expect(result.status).toBe('extended');
    });
  });

  describe('getClassPerformance', () => {
    test('calculates class average as percentage and finds at-risk students', async () => {
      // Mock course ownership
      supabase.from.mockImplementationOnce(() => mockSupabaseChain({ data: { educatorId: 'e-1' }, error: null }));
      // Mock enrollments
      supabase.from.mockImplementationOnce(() => mockSupabaseChain({ data: [{ learnerId: 'l-1', User: { displayName: 'John' } }], error: null }));
      // Mock submissions
      supabase.from.mockImplementationOnce(() => mockSupabaseChain({ 
        data: [{ score: 4, learnerId: 'l-1', Assessment: { totalPoints: 10 } }], // 40%
        error: null 
      }));
      // Mock study sessions
      supabase.from.mockImplementationOnce(() => mockSupabaseChain({ data: [], error: null }));

      const result = await AnalyticsService.getClassPerformance('c-1', 'e-1');
      
      expect(result.classAverageScore).toBe(40.0); // 4/10 * 100
      expect(result.atRiskStudents).toHaveLength(1); // 40% < 50%
      expect(result.atRiskStudents[0].needsAttention).toBe(true);
    });
  });
});