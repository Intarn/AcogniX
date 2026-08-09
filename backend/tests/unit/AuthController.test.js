/**
 * Place this file at: backend/tests/unit/AuthController.test.js
 *
 * These are pure unit tests:
 * - AuthController is tested directly.
 * - AuthenticationService is mocked.
 * - req/res are lightweight Jest mocks.
 */

jest.mock('../../service/AuthenticationService', () => ({
  signUp: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn()
}));

const AuthController = require('../../controllers/AuthController');
const AuthenticationService = require('../../service/AuthenticationService');
const { UserRole } = require('../../enums/AuthEnums');

function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AuthController unit tests', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    const validBody = {
      email: 'learner@example.com',
      password: 'Password123!',
      displayName: 'Test Learner',
      role: UserRole.LEARNER
    };

    const createdUser = {
      userId: 'user-001',
      email: validBody.email,
      displayName: validBody.displayName,
      role: UserRole.LEARNER,
      status: 'ACTIVE'
    };

    test.each([
      {
        name: 'returns 400 when a required field is missing',
        body: { ...validBody, email: '' },
        arrange: () => {},
        expectedStatus: 400,
        expectedBody: {
          message: 'Please complete all required fields.'
        },
        shouldCallService: false
      },
      {
        name: 'returns 400 when the email format is invalid',
        body: { ...validBody, email: 'invalid-email' },
        arrange: () => {},
        expectedStatus: 400,
        expectedBody: {
          message: 'Please enter a valid email address.'
        },
        shouldCallService: false
      },
      {
        name: 'returns 400 when the registration role is invalid',
        body: {
          ...validBody,
          role: UserRole.SYSTEM_ADMINISTRATOR
        },
        arrange: () => {},
        expectedStatus: 400,
        expectedBody: {
          message: 'Please select either Learner or Educator.'
        },
        shouldCallService: false
      },
      {
        name: 'returns 201 and the created user for valid input',
        body: validBody,
        arrange: () => {
          AuthenticationService.signUp.mockResolvedValueOnce(
            createdUser
          );
        },
        expectedStatus: 201,
        expectedBody: {
          message: 'Your account has been created successfully.',
          user: createdUser,
          redirectTo: '/login'
        },
        shouldCallService: true
      },
      {
        name: 'returns 409 when the email is already registered',
        body: validBody,
        arrange: () => {
          AuthenticationService.signUp.mockRejectedValueOnce(
            new Error('EMAIL_ALREADY_REGISTERED')
          );
        },
        expectedStatus: 409,
        expectedBody: {
          message: 'This email address is already registered.'
        },
        shouldCallService: true
      },
      {
        name: 'returns 500 when sign-up fails unexpectedly',
        body: validBody,
        arrange: () => {
          AuthenticationService.signUp.mockRejectedValueOnce(
            new Error('SIGNUP_FAILED')
          );
        },
        expectedStatus: 500,
        expectedBody: {
          message: 'Unable to create your account. Please try again.'
        },
        shouldCallService: true
      }
    ])(
      '$name',
      async ({
        body,
        arrange,
        expectedStatus,
        expectedBody,
        shouldCallService
      }) => {
        arrange();

        const req = { body };
        const res = createMockResponse();

        await AuthController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(expectedStatus);
        expect(res.json).toHaveBeenCalledWith(expectedBody);

        if (shouldCallService) {
          expect(AuthenticationService.signUp).toHaveBeenCalledWith(
            body.email,
            body.password,
            body.displayName,
            body.role
          );
        } else {
          expect(
            AuthenticationService.signUp
          ).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe('login()', () => {
    const validBody = {
      email: 'user@example.com',
      password: 'Password123!'
    };

    test.each([
      {
        name: 'returns 400 when email or password is missing',
        body: { email: validBody.email, password: '' },
        arrange: () => {},
        expectedStatus: 400,
        expectedBody: {
          message: 'Please enter your email and password.'
        },
        shouldCallService: false
      },
      {
        name: 'returns the Learner dashboard for a Learner',
        body: validBody,
        arrange: () => {
          AuthenticationService.logIn.mockResolvedValueOnce({
            tokenHash: 'learner-token',
            userRole: UserRole.LEARNER
          });
        },
        expectedStatus: 200,
        expectedBody: {
          message: 'Login successful',
          token: 'learner-token',
          redirectTo: '/learner-dashboard'
        },
        shouldCallService: true
      },
      {
        name: 'returns the Educator dashboard for an Educator',
        body: validBody,
        arrange: () => {
          AuthenticationService.logIn.mockResolvedValueOnce({
            tokenHash: 'educator-token',
            userRole: UserRole.EDUCATOR
          });
        },
        expectedStatus: 200,
        expectedBody: {
          message: 'Login successful',
          token: 'educator-token',
          redirectTo: '/educator-dashboard'
        },
        shouldCallService: true
      },
      {
        name: 'returns the admin portal for an Administrator',
        body: validBody,
        arrange: () => {
          AuthenticationService.logIn.mockResolvedValueOnce({
            tokenHash: 'admin-token',
            userRole: UserRole.SYSTEM_ADMINISTRATOR
          });
        },
        expectedStatus: 200,
        expectedBody: {
          message: 'Login successful',
          token: 'admin-token',
          redirectTo: '/admin-portal'
        },
        shouldCallService: true
      },
      {
        name: 'returns 403 for a banned account',
        body: validBody,
        arrange: () => {
          AuthenticationService.logIn.mockRejectedValueOnce(
            new Error('BANNED_ACCOUNT')
          );
        },
        expectedStatus: 403,
        expectedBody: {
          message:
            'Your account has been banned. Please contact the System Administrator for assistance.'
        },
        shouldCallService: true
      },
      {
        name: 'returns 500 when session creation fails',
        body: validBody,
        arrange: () => {
          AuthenticationService.logIn.mockRejectedValueOnce(
            new Error('SESSION_CREATION_FAILED')
          );
        },
        expectedStatus: 500,
        expectedBody: {
          message: 'Unable to log in at this time. Please try again.'
        },
        shouldCallService: true
      },
      {
        name: 'returns 401 for incorrect credentials',
        body: validBody,
        arrange: () => {
          AuthenticationService.logIn.mockRejectedValueOnce(
            new Error('INVALID_CREDENTIALS')
          );
        },
        expectedStatus: 401,
        expectedBody: {
          message: 'Incorrect email or password.'
        },
        shouldCallService: true
      }
    ])(
      '$name',
      async ({
        body,
        arrange,
        expectedStatus,
        expectedBody,
        shouldCallService
      }) => {
        arrange();

        const req = { body };
        const res = createMockResponse();

        await AuthController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(expectedStatus);
        expect(res.json).toHaveBeenCalledWith(expectedBody);

        if (shouldCallService) {
          expect(AuthenticationService.logIn).toHaveBeenCalledWith(
            body.email,
            body.password
          );
        } else {
          expect(
            AuthenticationService.logIn
          ).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe('logout()', () => {
    test.each([
      {
        name: 'returns 401 when the Bearer token is missing',
        headers: {},
        arrange: () => {},
        expectedStatus: 401,
        expectedBody: {
          message: 'Authentication required.'
        },
        expectedToken: null
      },
      {
        name: 'returns 200 when logout succeeds',
        headers: {
          authorization: 'Bearer valid-token'
        },
        arrange: () => {
          AuthenticationService.logOut.mockResolvedValueOnce(
            undefined
          );
        },
        expectedStatus: 200,
        expectedBody: {
          message: 'Logged out successfully',
          redirectTo: '/login'
        },
        expectedToken: 'valid-token'
      },
      {
        name: 'returns 500 when logout fails',
        headers: {
          authorization: 'Bearer failing-token'
        },
        arrange: () => {
          AuthenticationService.logOut.mockRejectedValueOnce(
            new Error('LOGOUT_FAILED')
          );
        },
        expectedStatus: 500,
        expectedBody: {
          message:
            'Error during logout, please clear client session.'
        },
        expectedToken: 'failing-token'
      }
    ])(
      '$name',
      async ({
        headers,
        arrange,
        expectedStatus,
        expectedBody,
        expectedToken
      }) => {
        arrange();

        const req = { headers };
        const res = createMockResponse();

        await AuthController.logout(req, res);

        expect(res.status).toHaveBeenCalledWith(expectedStatus);
        expect(res.json).toHaveBeenCalledWith(expectedBody);

        if (expectedToken) {
          expect(AuthenticationService.logOut).toHaveBeenCalledWith(
            expectedToken
          );
        } else {
          expect(
            AuthenticationService.logOut
          ).not.toHaveBeenCalled();
        }
      }
    );
  });
});
