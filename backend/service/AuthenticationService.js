// backend/service/AuthenticationService.js
const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const supabaseAuth = require('../config/supabaseAuthClient');
const User = require('../entities/User');
const UserSession = require('../entities/UserSession');
const { AccountStatus } = require('../enums/AuthEnums');
const AppError = require('../error/AppError');

class AuthenticationService {
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

    const expiresAt = new Date(authData.session.expires_at * 1000);
    // SỬA TẠI ĐÂY: Dùng crypto.randomUUID() chuẩn UUID v4 thay vì cắt chuỗi access_token
    const validSessionId = authData.session.session_id || crypto.randomUUID();

    const session = new UserSession(
      validSessionId,
      authData.session.access_token,
      new Date(),
      expiresAt
    );
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
      throw new AppError(500, 'SESSION_CREATION_FAILED', 'Unable to log in at this time. Please try again.');
    }

    return session;
  }

  // ===================================================================
  // LOG OUT (UC-22) - Thu hồi Session Server-side
  // ===================================================================
  static async logOut(token) {
    // 1. Cập nhật UserSession đánh dấu revokedAt
    const { error: sessionError } = await supabase
      .from('UserSession')
      .update({ revokedAt: new Date().toISOString() })
      .eq('tokenHash', token)
      .is('revokedAt', null);

    if (sessionError) {
      console.error('Cannot update revokedAt for UserSession:', sessionError.message);
      throw new AppError(500, 'LOGOUT_FAILED', 'Error during logout, please clear client session.');
    }

    // 2. Sign out khỏi Supabase Auth Admin
    const { error: authError } = await supabase.auth.admin.signOut(token, 'global');
    if (authError) {
      console.warn('Supabase global signout warning:', authError.message);
      throw new AppError(500, 'LOGOUT_FAILED', authError.message);
    }
  }

  // ===================================================================
  // VALIDATE SESSION (Middleware Auth Check)
  // ===================================================================
  static async validateSession(token) {
    // 1. Kiểm tra Blacklist/Revocation trong bảng UserSession
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('UserSession')
      .select('sessionId, revokedAt, expiresAt')
      .eq('tokenHash', token)
      .maybeSingle();

    if (!sessionError && sessionRecord) {
      if (sessionRecord.revokedAt !== null) {
        throw new AppError(401, 'INVALID_SESSION', 'Session has been logged out.');
      }
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        throw new AppError(401, 'INVALID_SESSION', 'Session has expired.');
      }
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