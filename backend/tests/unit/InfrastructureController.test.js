jest.mock('../../service/InfrastructureService', () => ({
  getSystemHealth: jest.fn(),
  getLLMUsage: jest.fn(),
  updateAPIKey: jest.fn()
}));

const InfrastructureController = require('../../controllers/InfrastructureController');
const InfrastructureService = require('../../service/InfrastructureService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('InfrastructureController unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getHealth() returns 200', async () => {
    const res = mockRes();
    InfrastructureService.getSystemHealth.mockResolvedValue({ status: 'ONLINE' });
    await InfrastructureController.getHealth({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ONLINE' });
  });

  test('updateKey() returns 200', async () => {
    const req = { body: { apiKey: 'new-key' } };
    const res = mockRes();
    InfrastructureService.updateAPIKey.mockResolvedValue({ success: true });
    await InfrastructureController.updateKey(req, res);
    expect(InfrastructureService.updateAPIKey).toHaveBeenCalledWith('new-key');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});