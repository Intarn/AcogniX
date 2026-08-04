const supabase = require('../config/supabaseClient');
const crypto = require('crypto');
const { UserRole, AccountStatus } = require('../enums/AuthEnums');
const EmailService = require('./EmailService');
const TwoFactorService = require('./TwoFactorService');

class UserManagementService {

  // Basic Flow #2 (UC-12): Admin searches for accounts by name or email.
  static async searchAccounts(query) {
    const { data, error } = await supabase
      .from('User')
      .select('userId, email, displayName, role, status, createdAt')
      .or(`email.ilike.%${query}%,displayName.ilike.%${query}%`)
      .limit(50);

    if (error) {
      const err = new Error('SEARCH_FAILED');
      err.status = 500;
      throw err;
    }
    return data;
  }

  // Basic Flow #3-4 (UC-12): Reset password
  static async resetPassword(targetUserId) {
    const { data: profile, error: profileError } = await supabase
      .from('User').select('email').eq('userId', targetUserId).single();
    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const tempPassword = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, { password: tempPassword });
    if (updateError) {
      const err = new Error('RESET_PASSWORD_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendPasswordReset(profile.email, tempPassword);
  }

  // Basic Flow #3-4 (UC-12): Ban account
  static async banAccount(targetUserId) {
    const { data: profile, error: profileError } = await supabase
      .from('User').select('email').eq('userId', targetUserId).single();
    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const { error } = await supabase
      .from('User')
      .update({ status: AccountStatus.BANNED, updatedAt: new Date() })
      .eq('userId', targetUserId);

    if (error) {
      const err = new Error('BAN_FAILED');
      err.status = 500;
      throw err;
    }

    // Revoke all active sessions immediately so the ban takes effect right away,
    // instead of waiting for the JWT to expire naturally.
    await supabase
      .from('UserSession')
      .update({ revokedAt: new Date() })
      .eq('userId', targetUserId)
      .is('revokedAt', null);

    await EmailService.sendAccountBanned(profile.email);
  }

  // Basic Flow #3-4 (UC-12): Unban account
  static async unbanAccount(targetUserId) {
    const { data: profile, error: profileError } = await supabase
      .from('User').select('email').eq('userId', targetUserId).single();
    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const { error } = await supabase
      .from('User')
      .update({ status: AccountStatus.ACTIVE, updatedAt: new Date() })
      .eq('userId', targetUserId);

    if (error) {
      const err = new Error('UNBAN_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendAccountUnbanned(profile.email);
  }

  // Basic Flow #3-4 (UC-12): Role assignment
  static async assignRole(targetUserId, newRole) {
    if (![UserRole.LEARNER, UserRole.EDUCATOR, UserRole.SYSTEM_ADMINISTRATOR].includes(newRole)) {
      const err = new Error('INVALID_ROLE');
      err.status = 400;
      throw err;
    }

    const { data: profile, error: profileError } = await supabase
      .from('User').select('email').eq('userId', targetUserId).single();
    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const { error } = await supabase
      .from('User')
      .update({ role: newRole, updatedAt: new Date() })
      .eq('userId', targetUserId);

    if (error) {
      const err = new Error('ASSIGN_ROLE_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendRoleChanged(profile.email, newRole);
  }

  // Alt Flow 1 (UC-12), step 1: request deletion -> 2FA code sent to the ADMIN's email
  static async requestAccountDeletion(adminUserId, adminEmail, targetUserId) {
    const { data: profile, error: profileError } = await supabase
      .from('User').select('userId').eq('userId', targetUserId).single();
    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    await TwoFactorService.requestCode(adminUserId, adminEmail, 'DELETE_ACCOUNT', targetUserId);
  }

  // Alt Flow 1 (UC-12), step 2: confirm deletion with the 2FA code
  static async confirmAccountDeletion(adminUserId, targetUserId, code) {
    await TwoFactorService.verifyCode(adminUserId, 'DELETE_ACCOUNT', targetUserId, code);

    const { data: profile, error: profileError } = await supabase
      .from('User').select('email').eq('userId', targetUserId).single();
    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const targetEmail = profile.email;

    // Deleting from auth.users cascades to "User" via ON DELETE CASCADE
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      const err = new Error('DELETE_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendAccountDeleted(targetEmail);
  }
}

module.exports = UserManagementService;