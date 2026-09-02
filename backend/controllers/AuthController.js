// backend/controllers/AuthController.js
const AuthenticationService = require('../service/AuthenticationService');
const { UserRole } = require('../enums/AuthEnums');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthController {
  // POST /api/auth/signup (UC-20)
  static async register(req, res) {
    try {
      const {
        email,
        displayName,
        nickname,
        password,
        confirmPassword,
        role
      } = req.body || {};

      const normalizedEmail = String(email || '').trim().toLowerCase();
      const finalDisplayName = String(displayName || nickname || '').trim();

      // UC20-UI04: Missing required information.
      if (
        !normalizedEmail ||
        !finalDisplayName ||
        !password ||
        !confirmPassword ||
        !role
      ) {
        return res.status(400).json({
          code: 'MISSING_REQUIRED_INFORMATION',
          message: 'Please complete all required fields.'
        });
      }

      // UC20-UI05: Invalid email format.
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({
          code: 'INVALID_EMAIL_FORMAT',
          message: 'Please enter a valid email address.'
        });
      }

      // UC20-UI03: Password confirmation mismatch.
      if (password !== confirmPassword) {
        return res.status(400).json({
          code: 'PASSWORD_CONFIRMATION_MISMATCH',
          message: 'Password and Confirm Password do not match.'
        });
      }

      // UC20-UI08: Self-registration is restricted to Learner/Educator.
      if (![UserRole.LEARNER, UserRole.EDUCATOR].includes(role)) {
        return res.status(400).json({
          code: 'INVALID_REGISTRATION_ROLE',
          message: 'Please select either Learner or Educator.'
        });
      }

      const user = await AuthenticationService.signUp(
        normalizedEmail,
        password,
        finalDisplayName,
        role
      );

      return res.status(201).json({
        message: 'Your account has been created successfully.',
        user,
        redirectTo: '/auth/login'
      });
    } catch (error) {
      // UC20-UI06/UI07: Duplicate email has its own recoverable flow.
      if (error.code === 'EMAIL_ALREADY_REGISTERED') {
        return res.status(409).json({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'This email address is already registered.'
        });
      }

      // UC20-UI09: Do not expose internal DB/Auth errors to the Sign Up UI.
      console.error('[AuthController.register] Account creation failed:', error);
      return res.status(500).json({
        code: 'SIGNUP_FAILED',
        message: 'Unable to create your account. Please try again.'
      });
    }
  }


  // POST /api/auth/forgot-password
  static async forgotPassword(req, res) {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        code: 'MISSING_EMAIL',
        message: 'Please enter your email address.'
      });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Please enter a valid email address.'
      });
    }

    try {
      await AuthenticationService.requestPasswordReset(email);
      return res.status(200).json({
        message: 'If an account exists for this email, a new temporary password has been sent to that email address.'
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        code: error.code || 'PASSWORD_RESET_REQUEST_FAILED',
        message: error.message || 'Unable to reset the password right now. Please try again.'
      });
    }
  }

  // POST /api/auth/login (UC-21)
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // UC21-UI04-A/B/C: Missing required information
      if (!email || !password) {
        return res.status(400).json({
          code: 'MISSING_REQUIRED_INFORMATION',
          message: 'Please enter your email and password.'
        });
      }

      const session = await AuthenticationService.logIn(email, password);

      let redirectTo = '/learner/dashboard';
      if (session.userRole === UserRole.EDUCATOR) {
        redirectTo = '/educator/dashboard';
      } else if (session.userRole === UserRole.SYSTEM_ADMINISTRATOR) {
        redirectTo = '/admin/dashboard';
      }

      return res.status(200).json({
        message: 'Login successful',
        token: session.accessToken,
        userRole: session.userRole,
        user: {
          userId: session.userId,
          email: session.email,
          role: session.userRole
        },
        redirectTo
      });
    } catch (error) {
      // UC21-UI07: Banned account
      if (error.code === 'BANNED_ACCOUNT') {
        return res.status(403).json({
          code: 'BANNED_ACCOUNT',
          message: 'Your account has been banned. Please contact the System Administrator for assistance.'
        });
      }

      // UC21-UI05/UI06: Invalid credentials
      if (error.code === 'INVALID_CREDENTIALS') {
        return res.status(401).json({
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password.'
        });
      }

      // UC21-UI08: Session creation failure
      if (error.code === 'SESSION_CREATION_FAILED') {
        return res.status(500).json({
          code: 'SESSION_CREATION_FAILED',
          message: 'Unable to log in at this time. Please try again.'
        });
      }

      return res.status(error.statusCode || 500).json({
        code: error.code || 'LOGIN_FAILED',
        message: error.statusCode
          ? error.message
          : 'Unable to log in at this time. Please try again.'
      });
    }
  }


  // POST /api/auth/test/fail-next - development/test only fault injection.
  // Lets PA5 exercise UC20-UI09 and UC21-UI08 without stopping Supabase.
  static async armTestFailure(req, res) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found.' });
    }

    try {
      const operation = String(req.body?.operation || '').trim().toLowerCase();
      AuthenticationService.armTestFailure(operation);
      return res.status(200).json({ success: true, operation });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        code: error.code || 'INVALID_TEST_OPERATION',
        message: error.message || 'Unable to configure test failure.'
      });
    }
  }

  // POST /api/auth/logout (UC-22)
  static async logout(req, res) {
    try {
      const token = req.token || req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      await AuthenticationService.logOut(token);

      return res.status(200).json({
        message: 'Logged out successfully',
        redirectTo: '/auth/login'
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Error during logout, please clear client session.'
      });
    }
  }
}

module.exports = AuthController;
