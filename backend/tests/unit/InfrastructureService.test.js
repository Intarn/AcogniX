jest.mock('os', () => ({
  totalmem: jest.fn().mockReturnValue(16 * 1024 * 1024 * 1024),
  freemem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024),
  uptime: jest.fn().mockReturnValue(3600),
  type: jest.fn().mockReturnValue('Windows_NT'),
  platform: jest.fn(),
  loadavg: jest.fn(),
  cpus: jest.fn()
}));

jest.mock('../../config/supabaseClient', () => ({
  from: jest.fn()
}));

const os = require('os');
const supabase = require('../../config/supabaseClient');
const InfrastructureService = require('../../service/InfrastructureService');

describe('InfrastructureService unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getSystemHealth uses accurate CPU calculation for Windows', async () => {
    os.platform.mockReturnValue('win32');
    os.cpus.mockReturnValue([
      { times: { user: 100, sys: 50, idle: 50 } } // total 200, active 150 -> 75%
    ]);
    
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ error: null })
    });

    const result = await InfrastructureService.getSystemHealth();
    
    expect(os.cpus).toHaveBeenCalled();
    expect(result.cpuLoad).toBe("75.00");
    expect(result.databaseStatus).toBe('ONLINE');
  });

  test('updateAPIKey rejects empty key', async () => {
    await expect(InfrastructureService.updateAPIKey('')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_KEY'
    });
  });
});