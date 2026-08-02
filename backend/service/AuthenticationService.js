// src/services/AuthenticationService.js
const supabase = require('../config/supabaseClient'); // File khởi tạo supabase
const User = require('../entities/User');
const UserSession = require('../entities/UserSession');

class AuthenticationService {
  // +signUp(email, password, displayName, role) : User
  static async signUp(email, password, displayName, role) {
    // Gọi Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const newUser = new User(authData.user.id, email, null, displayName, null, role, 'ACTIVE');

    // Lưu vào bảng User
    const { error: dbError } = await supabase.from('User').insert([{
      userId: newUser.userId,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
      status: newUser.status
    }]);
    
    if (dbError) throw dbError;
    return newUser;
  }

  // +logIn(email, password) : UserSession
  static async logIn(email, password) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    // Lấy profile check AccountStatus
    const { data: userProfile, error: profileError } = await supabase
      .from('User')
      .select('role, status')
      .eq('userId', authData.user.id)
      .single();

    if (profileError) throw profileError;
    
    if (userProfile.status === 'BANNED') {
      throw new Error('BANNED_ACCOUNT');
    }

    // Khởi tạo thực thể UserSession trả về
    const session = new UserSession(
      authData.session.session_id, 
      authData.session.access_token, 
      new Date(), 
      new Date(authData.session.expires_at * 1000)
    );
    
    // Gắn thêm role để controller xử lý điều hướng
    session.userRole = userProfile.role; 
    return session;
  }

  // +logOut(sessionId) : void
  static async logOut(token) {
    const { error } = await supabase.auth.signOut(token);
    if (error) throw error;
  }

  // +validateSession(token) : UserSession
  static async validateSession(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return data;
  }
}

module.exports = AuthenticationService;