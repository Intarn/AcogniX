jest.mock('../../service/AuthenticationService', () => ({
  validateSession: jest.fn()
}));

const AuthenticationService = require('../../service/AuthenticationService');
const { requireAuth, authorize } = require('../../middleware/authMiddleware');
const { UserRole } = require('../../enums/AuthEnums');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Authentication/authorization middleware used by UC-09, UC-10 and UC-25', () => {
  beforeEach(() => jest.clearAllMocks());

  test('requireAuth rejects request without Bearer token', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAuth validates token and stores userId/role in req.user', async () => {
    AuthenticationService.validateSession.mockResolvedValue({ userId: 'l-1', role: UserRole.LEARNER });
    const req = { headers: { authorization: 'Bearer token-123' } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(AuthenticationService.validateSession).toHaveBeenCalledWith('token-123');
    expect(req.user).toEqual({ userId: 'l-1', role: UserRole.LEARNER });
    expect(req.token).toBe('token-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requireAuth rejects invalid session', async () => {
    AuthenticationService.validateSession.mockRejectedValue(new Error('INVALID_SESSION'));
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('authorize rejects missing req.user', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    authorize(UserRole.EDUCATOR)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('authorize blocks Learner from Educator-only UC-09 operations', () => {
    const req = { user: { userId: 'l-1', role: UserRole.LEARNER } };
    const res = mockRes();
    const next = jest.fn();
    authorize(UserRole.EDUCATOR)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('authorize blocks Educator from Learner-only UC-10/UC-25 operations', () => {
    const req = { user: { userId: 'e-1', role: UserRole.EDUCATOR } };
    const res = mockRes();
    const next = jest.fn();
    authorize(UserRole.LEARNER)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('authorize calls next for an allowed role', () => {
    const req = { user: { userId: 'e-1', role: UserRole.EDUCATOR } };
    const res = mockRes();
    const next = jest.fn();
    authorize(UserRole.EDUCATOR)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
