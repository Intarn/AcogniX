const supabase = require('../config/supabaseClient');
const { UserRole, AccountStatus } = require('../enums/AuthEnums');
const EmailService = require('./EmailService');
const TwoFactorService = require('./TwoFactorService');

const USER_SELECT_FIELDS = 'userId, email, displayName, role, status, createdAt';

class UserManagementService {
  static async getTargetAccount(targetUserId) {
    const { data: profile, error } = await supabase
      .from('User')
      .select('userId, email, role, status')
      .eq('userId', targetUserId)
      .single();

    if (error || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    return profile;
  }

  static assertManageableNonAdminTarget(adminUserId, profile, action) {
    if (profile.userId === adminUserId) {
      const err = new Error('CANNOT_MANAGE_SELF');
      err.status = 403;
      throw err;
    }
    if (profile.role === UserRole.SYSTEM_ADMINISTRATOR) {
      const err = new Error('ADMIN_ACCOUNT_PROTECTED');
      err.status = 403;
      throw err;
    }
    if (action === 'assignRole') return;
  }
  // Basic Flow #2 (UC-12): Admin searches for accounts by exact name or email.
  // When the search box is empty, return the latest accounts for the management list.
  static async searchAccounts(query) {
    const normalizedQuery = String(query || '').trim();

    if (!normalizedQuery) {
      const { data, error } = await supabase
        .from('User')
        .select(USER_SELECT_FIELDS)
        .order('createdAt', { ascending: false })
        .limit(50);

      if (error) {
        const err = new Error('SEARCH_FAILED');
        err.status = 500;
        throw err;
      }

      return data || [];
    }

    // Two explicit queries avoid broad "contains" matching. This is important for
    // UI01/UI09: searching a complete email/name must not also return unrelated
    // accounts such as "Nguyen Van Anh" for "Nguyen Van An".
    const [emailResult, nameResult] = await Promise.all([
      supabase
        .from('User')
        .select(USER_SELECT_FIELDS)
        .ilike('email', normalizedQuery)
        .limit(50),
      supabase
        .from('User')
        .select(USER_SELECT_FIELDS)
        .ilike('displayName', normalizedQuery)
        .limit(50)
    ]);

    if (emailResult.error || nameResult.error) {
      const err = new Error('SEARCH_FAILED');
      err.status = 500;
      throw err;
    }

    const uniqueUsers = new Map();
    [...(emailResult.data || []), ...(nameResult.data || [])].forEach((user) => {
      uniqueUsers.set(user.userId, user);
    });

    return [...uniqueUsers.values()].sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }


  // Basic Flow #3-4 (UC-12): Ban account.
  static async banAccount(adminUserId, targetUserId) {
    const profile = await this.getTargetAccount(targetUserId);
    this.assertManageableNonAdminTarget(adminUserId, profile, 'ban');

    const { error } = await supabase
      .from('User')
      .update({ status: AccountStatus.BANNED, updatedAt: new Date() })
      .eq('userId', targetUserId);

    if (error) {
      const err = new Error('BAN_FAILED');
      err.status = 500;
      throw err;
    }

    // Revoke active application sessions immediately so the banned account
    // cannot continue using an already-open browser session.
    const { error: revokeError } = await supabase
      .from('UserSession')
      .update({ revokedAt: new Date() })
      .eq('userId', targetUserId)
      .is('revokedAt', null);

    if (revokeError) {
      const err = new Error('BAN_SESSION_REVOKE_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendAccountBanned(profile.email);
  }

  // Basic Flow #3-4 (UC-12): Unban account.
  static async unbanAccount(adminUserId, targetUserId) {
    const profile = await this.getTargetAccount(targetUserId);
    this.assertManageableNonAdminTarget(adminUserId, profile, 'unban');

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

  // Basic Flow #3-4 (UC-12): Role assignment.
  static async assignRole(adminUserId, targetUserId, newRole) {
    if (
      ![
        UserRole.LEARNER,
        UserRole.EDUCATOR
      ].includes(newRole)
    ) {
      const err = new Error('INVALID_ROLE');
      err.status = 400;
      throw err;
    }

    const profile = await this.getTargetAccount(targetUserId);
    this.assertManageableNonAdminTarget(adminUserId, profile, 'assignRole');

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

  // Alternative Flow 1 (UC-12), step 1: request a 2FA code for deletion.
  // The verification code is sent to the logged-in administrator, not the
  // target account being deleted.
  static async requestAccountDeletion(adminUserId, adminEmail, targetUserId) {
    const profile = await this.getTargetAccount(targetUserId);
    this.assertManageableNonAdminTarget(adminUserId, profile, 'delete');

    await TwoFactorService.requestCode(
      adminUserId,
      adminEmail,
      'DELETE_ACCOUNT',
      targetUserId
    );
  }

  // Alternative Flow 1 (UC-12), step 2: verify 2FA and permanently delete.
  static async confirmAccountDeletion(adminUserId, targetUserId, code) {
    const target = await this.getTargetAccount(targetUserId);
    this.assertManageableNonAdminTarget(adminUserId, target, 'delete');

    await TwoFactorService.verifyCode(
      adminUserId,
      'DELETE_ACCOUNT',
      targetUserId,
      code
    );

    const { data: profile, error: profileError } = await supabase
      .from('User')
      .select('email')
      .eq('userId', targetUserId)
      .single();

    if (profileError || !profile) {
      const err = new Error('USER_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const targetEmail = profile.email;

    // Remove the Supabase Auth identity first so the deleted account can no
    // longer authenticate. In deployments with an ON DELETE CASCADE this also
    // removes the profile row.
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      const err = new Error('DELETE_FAILED');
      err.status = 500;
      throw err;
    }

    // Keep this cleanup even when a database cascade exists. Deleting a row
    // that is already gone is harmless, while it guarantees UI06 can no longer
    // find the account if the deployment does not have the expected cascade.
    const { error: deleteProfileError } = await supabase
      .from('User')
      .delete()
      .eq('userId', targetUserId);

    if (deleteProfileError) {
      const err = new Error('DELETE_PROFILE_CLEANUP_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendAccountDeleted(targetEmail);
  }

  static async getTotalUsers() {
    const { data, error } = await supabase
      .from('User')
      .select('userId');

    if (error) {
      const err = new Error('COUNT_FAILED');
      err.status = 500;
      throw err;
    }

    return data ? data.length : 0;
  }
}

module.exports = UserManagementService;
