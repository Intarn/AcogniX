// backend/service/AuthenticationService.js
const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const supabaseAuth = require('../config/supabaseAuthClient');
const User = require('../entities/User');
const UserSession = require('../entities/UserSession');
const { AccountStatus } = require('../enums/AuthEnums');
const AppError = require('../error/AppError');

let failNextSignupAfterAuthCreation = false;
let failNextSessionCreation = false;

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''), 'utf8')
    .digest('hex');
}


class AuthenticationService {
  static armTestFailure(operation) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }

    if (operation === 'signup') {
      failNextSignupAfterAuthCreation = true;
      return true;
    }
    if (operation === 'session') {
      failNextSessionCreation = true;
      return true;
    }

    throw new AppError(400, 'INVALID_TEST_OPERATION', 'operation must be signup or session.');
  }

  // ===================================================================
  // SIGN UP (UC-20)
  // ===================================================================
  static async signUp(email, password, displayName, role) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();

    // Check the application profile table first so an existing account is
    // rejected before any Auth-side mutation is attempted.
    const { data: existing, error: checkError } = await supabase
      .from('User')
      .select('userId')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (checkError) {
      console.error('[AuthService.signUp] Cannot check existing user:', checkError);
      throw new AppError(
        500,
        'SIGNUP_FAILED',
        'Unable to create your account. Please try again.'
      );
    }

    if (existing) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'This email address is already registered.'
      );
    }

    let createdAuthUserId = null;

    try {
      // Create the Auth identity on the trusted server. Email is confirmed so
      // the account can immediately authenticate as required by UC20 UI01/UI02.
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          displayName: normalizedDisplayName,
          role
        }
      });

      if (authError) {
        const authMessage = String(authError.message || '');
        const duplicateEmail = /already\s+(been\s+)?registered|already\s+exists|user.*exists/i.test(
          authMessage
        );

        if (duplicateEmail) {
          throw new AppError(
            409,
            'EMAIL_ALREADY_REGISTERED',
            'This email address is already registered.'
          );
        }

        console.error('[AuthService.signUp] Supabase Auth createUser failed:', authError);
        throw new AppError(
          500,
          'SIGNUP_FAILED',
          'Unable to create your account. Please try again.'
        );
      }

      if (!authData?.user?.id) {
        throw new AppError(
          500,
          'SIGNUP_FAILED',
          'Unable to create your account. Please try again.'
        );
      }

      createdAuthUserId = authData.user.id;

      // Non-production one-shot fault injection for UC20-UI09. It fails after
      // the Auth identity exists so the compensating delete path is exercised.
      if (failNextSignupAfterAuthCreation) {
        failNextSignupAfterAuthCreation = false;
        throw new AppError(500, 'SIGNUP_FAILED', 'Unable to create your account. Please try again.');
      }

      const newUser = new User(
        createdAuthUserId,
        normalizedEmail,
        null,
        normalizedDisplayName,
        null,
        role,
        AccountStatus.ACTIVE
      );

      // Persist the application profile only after Auth identity creation.
      const { error: dbError } = await supabase.from('User').insert([{
        userId: newUser.userId,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        status: newUser.status
      }]);

      if (dbError) {
        console.error('[AuthService.signUp] User profile insert failed:', dbError);
        throw new AppError(
          500,
          'SIGNUP_FAILED',
          'Unable to create your account. Please try again.'
        );
      }

      return newUser;
    } catch (error) {
      // UC20-UI09: if Auth identity was created but application-profile creation
      // fails, compensate by deleting that Auth identity. This prevents the
      // incomplete account that previously remained in Supabase Auth.
      if (createdAuthUserId) {
        const { error: rollbackError } = await supabase.auth.admin.deleteUser(
          createdAuthUserId
        );

        if (rollbackError) {
          console.error(
            '[AuthService.signUp] Failed to rollback Auth user after registration failure:',
            rollbackError
          );
        }
      }

      throw error;
    }
  }

  // ===================================================================
  // LOG IN (UC-21)
  // ===================================================================
  static async logIn(email, password) {
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (authError) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }

    // Lấy profile user
    const { data: userProfile, error: profileError } = await supabase
      .from('User')
      .select('userId, email, role, status')
      .eq('userId', authData.user.id)
      .maybeSingle();

    if (profileError || !userProfile) {
      throw new AppError(500, 'SESSION_CREATION_FAILED', 'Unable to log in at this time. Please try again.');
    }

    if (userProfile.status === AccountStatus.BANNED) {
      throw new AppError(403, 'BANNED_ACCOUNT', 'Your account has been banned. Please contact the System Administrator for assistance.');
    }

    // Non-production one-shot fault injection for UC21-UI08. The current
    // Supabase token is revoked and no UserSession row is created. Because the
    // flag is consumed, the tester can immediately retry successfully.
    if (failNextSessionCreation) {
      failNextSessionCreation = false;
      try {
        await supabase.auth.admin.signOut(authData.session.access_token, 'global');
      } catch (revokeError) {
        console.warn('[AuthService] Failed to revoke simulated failed-session token:', revokeError?.message || revokeError);
      }
      throw new AppError(500, 'SESSION_CREATION_FAILED', 'Unable to log in at this time. Please try again.');
    }

    const expiresAt = new Date(authData.session.expires_at * 1000);
    // SỬA TẠI ĐÂY: Dùng crypto.randomUUID() chuẩn UUID v4 thay vì cắt chuỗi access_token
    const validSessionId = authData.session.session_id || crypto.randomUUID();

    const accessToken = authData.session.access_token;
    const session = new UserSession(
      validSessionId,
      hashToken(accessToken),
      new Date(),
      expiresAt
    );
    // The raw token is returned to the authenticated client, but never persisted
    // in UserSession. Only its SHA-256 digest is stored server-side.
    session.accessToken = accessToken;
    // Attach authenticated user information so the controller can return
    // the correct role immediately after login.
    session.userId = userProfile.userId;
    session.email = userProfile.email;
    session.userRole = userProfile.role;

    // Lưu phiên đăng nhập vào UserSession
    const { error: sessionInsertError } = await supabase.from('UserSession').insert([{
      sessionId: session.sessionId,
      userId: authData.user.id,
      tokenHash: session.tokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }]);

    if (sessionInsertError) {
      console.error('[AuthService] Session creation DB failure:', sessionInsertError);
      try {
        await supabase.auth.admin.signOut(accessToken, 'global');
      } catch (revokeError) {
        console.error('[AuthService] Failed to revoke token after session insert failure:', revokeError);
      }
      throw new AppError(500, 'SESSION_CREATION_FAILED', 'Unable to log in at this time. Please try again.');
    }

    return session;
  }

  // ===================================================================
  // LOG OUT (UC-22) - Thu hồi Session Server-side
  // ===================================================================
  static async logOut(token) {
    const digest = hashToken(token);

    // Local revocation is authoritative and happens before the external Auth call.
    const { error: sessionError } = await supabase
      .from('UserSession')
      .update({ revokedAt: new Date().toISOString() })
      .eq('tokenHash', digest)
      .is('revokedAt', null);

    if (sessionError) {
      console.error('Cannot update revokedAt for UserSession:', sessionError.message);
      throw new AppError(500, 'LOGOUT_FAILED', 'Error during logout, please clear client session.');
    }

    // Global Supabase sign-out is best-effort after local revocation. Failure here
    // must not make the locally revoked session valid again.
    try {
      const { error: authError } = await supabase.auth.admin.signOut(token, 'global');
      if (authError) {
        console.warn('Supabase global signout warning:', authError.message);
      }
    } catch (authError) {
      console.warn('Supabase global signout warning:', authError?.message || authError);
    }

    return true;
  }

  // ===================================================================
  // VALIDATE SESSION (Middleware Auth Check)
  // ===================================================================
  static async validateSession(token) {
    // 1. A valid Supabase token is not enough: the application session row
    // must exist, match the token digest, be unrevoked and unexpired.
    const digest = hashToken(token);
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('UserSession')
      .select('sessionId, revokedAt, expiresAt')
      .eq('tokenHash', digest)
      .maybeSingle();

    if (sessionError || !sessionRecord) {
      throw new AppError(401, 'INVALID_SESSION', 'Session is invalid.');
    }
    if (sessionRecord.revokedAt !== null) {
      throw new AppError(401, 'INVALID_SESSION', 'Session has been logged out.');
    }
    if (new Date(sessionRecord.expiresAt) < new Date()) {
      throw new AppError(401, 'INVALID_SESSION', 'Session has expired.');
    }

    // 2. Xác thực Token với Supabase Auth
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authUser) {
      throw new AppError(401, 'INVALID_SESSION', 'Session expired or invalid. Please log in again.');
    }

    // 3. Kiểm tra trạng thái User trong Database
    const { data: userProfile, error: profileError } = await supabase
      .from('User')
      .select('userId, email, role, status')
      .eq('userId', authUser.id)
      .maybeSingle();

    if (profileError || !userProfile) {
      throw new AppError(401, 'USER_PROFILE_NOT_FOUND', 'User profile not found.');
    }

    if (userProfile.status !== AccountStatus.ACTIVE) {
      throw new AppError(403, 'BANNED_ACCOUNT', 'Your account has been banned.');
    }

    return {
      userId: userProfile.userId,
      email: userProfile.email,
      role: userProfile.role
    };
  }

  static async changePassword(userId, email, currentPassword, newPassword) {
    const { error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password: currentPassword
    });

    if (authError) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác.');
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateError) {
      throw new AppError(500, 'CHANGE_PASSWORD_FAILED', 'Không thể đặt mật khẩu.');
    }

    return true;
  }
}

module.exports = AuthenticationService;