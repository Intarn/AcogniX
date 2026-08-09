/**
 * Place this file at: backend/tests/unit/AuthenticationService.test.js
 *
 * AuthenticationService is tested with a mocked Supabase client.
 * No real Supabase project or network connection is used.
 */

jest.mock('../../config/supabaseClient', () => ({
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
    admin: {
      signOut: jest.fn()
    }
  },
  from: jest.fn()
}));

const supabase = require('../../config/supabaseClient');
const AuthenticationService = require('../../service/AuthenticationService');
const { UserRole, AccountStatus } = require('../../enums/AuthEnums');

function makeAuthData({
  userId = 'user-001',
  token = 'access-token',
  sessionId = 'session-001'
} = {}) {
  return {
    user: {
      id: userId
    },
    session: {
      session_id: sessionId,
      access_token: token,
      expires_at: 2_000_000_000
    }
  };
}

describe('AuthenticationService unit tests', () => {
  let userTable;
  let userSessionTable;
  let sessionUpdateChain;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetAllMocks();

    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    userTable = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      insert: jest.fn()
    };

    sessionUpdateChain = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({ error: null })
    };

    userSessionTable = {
      insert: jest.fn(),
      update: jest.fn().mockReturnValue(sessionUpdateChain)
    };

    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'User') return userTable;
      if (tableName === 'UserSession') return userSessionTable;

      throw new Error(`Unexpected table: ${tableName}`);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('signUp()', () => {
    const input = {
      email: 'learner@example.com',
      password: 'Password123!',
      displayName: 'Test Learner',
      role: UserRole.LEARNER
    };

    test.each([
      {
        name: 'rejects an email already stored in the User table',
        arrange: () => {
          userTable.maybeSingle.mockResolvedValue({
            data: { userId: 'existing-user' },
            error: null
          });
        },
        expectedError: {
          message: 'EMAIL_ALREADY_REGISTERED',
          status: 409
        }
      },
      {
        name: 'rejects when Supabase Auth sign-up fails',
        arrange: () => {
          userTable.maybeSingle.mockResolvedValue({
            data: null,
            error: null
          });
          supabase.auth.signUp.mockResolvedValue({
            data: null,
            error: new Error('Supabase unavailable')
          });
        },
        expectedError: {
          message: 'SIGNUP_FAILED',
          status: 500
        }
      },
      {
        name: 'rejects when Supabase reports an empty identity list',
        arrange: () => {
          userTable.maybeSingle.mockResolvedValue({
            data: null,
            error: null
          });
          supabase.auth.signUp.mockResolvedValue({
            data: {
              user: {
                id: 'user-001',
                identities: []
              }
            },
            error: null
          });
        },
        expectedError: {
          message: 'EMAIL_ALREADY_REGISTERED',
          status: 409
        }
      },
      {
        name: 'rejects when the application User cannot be stored',
        arrange: () => {
          userTable.maybeSingle.mockResolvedValue({
            data: null,
            error: null
          });
          supabase.auth.signUp.mockResolvedValue({
            data: {
              user: {
                id: 'user-001',
                identities: [{ id: 'identity-001' }]
              }
            },
            error: null
          });
          userTable.insert.mockResolvedValue({
            error: new Error('Database failure')
          });
        },
        expectedError: {
          message: 'SIGNUP_FAILED',
          status: 500
        }
      },
      {
        name: 'returns a new active User for valid input',
        arrange: () => {
          userTable.maybeSingle.mockResolvedValue({
            data: null,
            error: null
          });
          supabase.auth.signUp.mockResolvedValue({
            data: {
              user: {
                id: 'user-001',
                identities: [{ id: 'identity-001' }]
              }
            },
            error: null
          });
          userTable.insert.mockResolvedValue({
            error: null
          });
        },
        expectedUser: {
          userId: 'user-001',
          email: input.email,
          displayName: input.displayName,
          role: UserRole.LEARNER,
          status: AccountStatus.ACTIVE
        }
      }
    ])('$name', async ({ arrange, expectedError, expectedUser }) => {
      arrange();

      if (expectedError) {
        await expect(
          AuthenticationService.signUp(
            input.email,
            input.password,
            input.displayName,
            input.role
          )
        ).rejects.toMatchObject(expectedError);
        return;
      }

      const result = await AuthenticationService.signUp(
        input.email,
        input.password,
        input.displayName,
        input.role
      );

      expect(result).toMatchObject(expectedUser);
      expect(userTable.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: expectedUser.userId,
          email: expectedUser.email,
          displayName: expectedUser.displayName,
          role: expectedUser.role,
          status: expectedUser.status
        })
      ]);
    });
  });

  describe('logIn()', () => {
    const input = {
      email: 'user@example.com',
      password: 'Password123!'
    };

    test.each([
      {
        name: 'rejects incorrect credentials',
        arrange: () => {
          supabase.auth.signInWithPassword.mockResolvedValue({
            data: null,
            error: new Error('Invalid credentials')
          });
        },
        expectedError: {
          message: 'INVALID_CREDENTIALS',
          status: 401
        }
      },
      {
        name: 'returns a session-creation error when the profile query fails',
        arrange: () => {
          supabase.auth.signInWithPassword.mockResolvedValue({
            data: makeAuthData(),
            error: null
          });
          userTable.single.mockResolvedValue({
            data: null,
            error: new Error('Profile query failed')
          });
        },
        expectedError: {
          message: 'SESSION_CREATION_FAILED',
          status: 500
        }
      },
      {
        name: 'rejects a banned account',
        arrange: () => {
          supabase.auth.signInWithPassword.mockResolvedValue({
            data: makeAuthData(),
            error: null
          });
          userTable.single.mockResolvedValue({
            data: {
              role: UserRole.LEARNER,
              status: AccountStatus.BANNED
            },
            error: null
          });
        },
        expectedError: {
          message: 'BANNED_ACCOUNT',
          status: 403
        }
      },
      {
        name: 'returns a Learner session',
        arrange: () => {
          supabase.auth.signInWithPassword.mockResolvedValue({
            data: makeAuthData({
              token: 'learner-token',
              sessionId: 'learner-session'
            }),
            error: null
          });
          userTable.single.mockResolvedValue({
            data: {
              role: UserRole.LEARNER,
              status: AccountStatus.ACTIVE
            },
            error: null
          });
          userSessionTable.insert.mockResolvedValue({
            error: null
          });
        },
        expectedSession: {
          sessionId: 'learner-session',
          tokenHash: 'learner-token',
          userRole: UserRole.LEARNER
        }
      },
      {
        name: 'returns an Educator session',
        arrange: () => {
          supabase.auth.signInWithPassword.mockResolvedValue({
            data: makeAuthData({
              token: 'educator-token',
              sessionId: 'educator-session'
            }),
            error: null
          });
          userTable.single.mockResolvedValue({
            data: {
              role: UserRole.EDUCATOR,
              status: AccountStatus.ACTIVE
            },
            error: null
          });
          userSessionTable.insert.mockResolvedValue({
            error: null
          });
        },
        expectedSession: {
          sessionId: 'educator-session',
          tokenHash: 'educator-token',
          userRole: UserRole.EDUCATOR
        }
      }
    ])('$name', async ({ arrange, expectedError, expectedSession }) => {
      arrange();

      if (expectedError) {
        await expect(
          AuthenticationService.logIn(
            input.email,
            input.password
          )
        ).rejects.toMatchObject(expectedError);
        return;
      }

      const result = await AuthenticationService.logIn(
        input.email,
        input.password
      );

      expect(result).toMatchObject(expectedSession);
      expect(userSessionTable.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          sessionId: expectedSession.sessionId,
          tokenHash: expectedSession.tokenHash,
          createdAt: expect.any(Date),
          expiresAt: expect.any(Date)
        })
      ]);
    });
  });

  describe('logOut()', () => {
    test.each([
      {
        name: 'revokes the Supabase session and stores revokedAt',
        token: 'valid-token',
        arrange: () => {
          supabase.auth.admin.signOut.mockResolvedValue({
            error: null
          });
        },
        expectedErrorMessage: null
      },
      {
        name: 'throws when Supabase cannot revoke the session',
        token: 'invalid-token',
        arrange: () => {
          supabase.auth.admin.signOut.mockResolvedValue({
            error: new Error('Sign-out failed')
          });
        },
        expectedErrorMessage: 'Sign-out failed'
      }
    ])(
      '$name',
      async ({
        token,
        arrange,
        expectedErrorMessage
      }) => {
        arrange();

        if (expectedErrorMessage) {
          await expect(
            AuthenticationService.logOut(token)
          ).rejects.toThrow(expectedErrorMessage);

          expect(userSessionTable.update).not.toHaveBeenCalled();
          return;
        }

        await expect(
          AuthenticationService.logOut(token)
        ).resolves.toBeUndefined();

        expect(
          supabase.auth.admin.signOut
        ).toHaveBeenCalledWith(token, 'global');

        expect(userSessionTable.update).toHaveBeenCalledWith({
          revokedAt: expect.any(Date)
        });

        expect(sessionUpdateChain.eq).toHaveBeenCalledWith(
          'tokenHash',
          token
        );

        expect(sessionUpdateChain.is).toHaveBeenCalledWith(
          'revokedAt',
          null
        );
      }
    );
  });

  describe('validateSession()', () => {
    test.each([
      {
        name: 'rejects an invalid Supabase session',
        arrange: () => {
          supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: new Error('Invalid token')
          });
        },
        expectedError: {
          message: 'INVALID_SESSION',
          status: 401
        }
      },
      {
        name: 'returns an active user identity',
        arrange: () => {
          supabase.auth.getUser.mockResolvedValue({
            data: {
              user: {
                id: 'user-001'
              }
            },
            error: null
          });
          userTable.maybeSingle.mockResolvedValue({
            data: {
              userId: 'user-001',
              email: 'user@example.com',
              role: UserRole.LEARNER,
              status: AccountStatus.ACTIVE
            },
            error: null
          });
        },
        expectedResult: {
          userId: 'user-001',
          email: 'user@example.com',
          role: UserRole.LEARNER
        }
      },
      {
        name: 'rejects a banned user profile',
        arrange: () => {
          supabase.auth.getUser.mockResolvedValue({
            data: {
              user: {
                id: 'user-001'
              }
            },
            error: null
          });
          userTable.maybeSingle.mockResolvedValue({
            data: {
              userId: 'user-001',
              email: 'user@example.com',
              role: UserRole.LEARNER,
              status: AccountStatus.BANNED
            },
            error: null
          });
        },
        expectedError: {
          message: 'BANNED_ACCOUNT',
          status: 403
        }
      }
    ])('$name', async ({ arrange, expectedError, expectedResult }) => {
      arrange();

      if (expectedError) {
        await expect(
          AuthenticationService.validateSession('test-token')
        ).rejects.toMatchObject(expectedError);
        return;
      }

      await expect(
        AuthenticationService.validateSession('test-token')
      ).resolves.toEqual(expectedResult);
    });
  });
});
