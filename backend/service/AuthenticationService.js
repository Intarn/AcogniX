const supabase = require('../config/supabaseClient');
const User = require('../entities/User');
const UserSession = require('../entities/UserSession');

class AuthenticationService {

  // ===================================================================
  // SIGN UP (UC-22)
  // ===================================================================
  // +signUp(email, password, displayName, role) : User

  static async signUp(email, password, displayName, role) {
    // Gọi Supabase Auth
    const {data: existing} = await supabase
      .from('User')
      .select('userId')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      const err = new Error('EMAL_ALREADY_REGISTERD');
      err.status = 409;
      throw err;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({email, password});
    
    if (authError) {
      const err = new Error('SIGNUP_FAILED');
      err.status = 500;
      throw err;
    }

    if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
      const err = new Error('EMAIL_ALREADY_REGISTERED');
      err.status = 409;
      throw err;
    }

    const newUser = new User(authData.user.id, email, null, displayName, null, role, 'ACTIVE');

    // Lưu vào bảng User
    const { error: dbError } = await supabase.from('User').insert([{
      userId: newUser.userId,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
      status: newUser.status
    }]);
    
    if (dbError) {
      const err = new Error('SIGNUP_FAILED'); // altermative flow 5 (UC-22)
      err.status = 500;
      throw err;
    }

    return newUser;
  }

  // ===================================================================
  // LOG IN (UC-23)
  // ===================================================================
  // +logIn(email, password) : UserSession  
  
  static async logIn(email, password) {
    // Find account + Check password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    console.error("LOGIN ERROR:", authError);
    if (authError) {
      const err = new Error('INVALID_CREDENTIALS');
      err.status = 401;
      throw err;
    }

    // Alternative Flow 4 (UC-23):  Invalid Registration Role

    let userProfile;
    try {
      const { data, error: profileError } = await supabase
        .from('User')
        .select('role, status')
        .eq('userId', authData.user.id)
        .single();

        if (profileError) throw profileError;
        userProfile = data;
    } catch (e) {
      const err = new Error('SESSION_CREATION_FAILED');
      err.status = 500;
      throw err;
    }

    // Alternative flow 3 (UC-23): Email Already Registered
    if (userProfile.status === 'BANNED') {
      const err = new Error('BANNED_ACCOUNT');
      err.status = 403;
      throw err;
    }

    // Identify role and Create session
    const expiresAt = new Date(authData.session.expires_at * 1000);
    const session = new UserSessio(
      authData.session.session_id,
      authData.session.access_token,
      new Date(),
      expiresAt
    );
    session.userRole = userProfile.role;
    
    try {
      await supabase.from('UserSession').insert([{
        sessionId: session.sessionId,
        userId: authData.user.id,
        tokenHash: session.tokenHash,
        createAt: session.createAt,
        expiresAt: session.expiresAt
      }]);
    } catch (e) {
      console.error('Cannot store UserSession:', e.message);
    }

    return session;
  }

  // ===================================================================
  // LOG OUT (UC-24)
  // ===================================================================
  // +logOut(token) : void
  static async logOut(token) {
    const { error } = await supabase.auth.admin.signOut(token, 'global');
    if (error) throw error;

    try {
      await supabase
        .from('UserSession')
        .update({ revokedAt: new Date() })
        .eq('tokenHash', token)
        .is('revokedAt', null);
    } catch (e) {
      console.error('Cannot update revokedAt for UserSession:', e.message);
    }
  }

  // +validateSession(token) : UserSession
  static async validateSession(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      const err = new Error('INVALID_SESSION');
      err.status = 401;
      throw err;
    }
    
    return data;
  }
}

module.exports = AuthenticationService;