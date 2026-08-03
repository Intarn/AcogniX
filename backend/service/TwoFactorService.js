const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const EmailService = require('./EmailService');

const CODE_TTL_MINUTES = 5;

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

class TwoFactorService {

  // UC-12 Alternative flow 1, step 1: generate a 6-digit code, store its hash, email it
  // to the ADMIN's own address (not the target account being deleted).
  static async requestCode(adminUserId, adminEmail, purpose, targetUserId) {
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    const { error } = await supabase.from('TwoFactorCode').insert([{
      userId: adminUserId,
      codeHash,
      purpose,
      targetUserId,
      expiresAt
    }]);

    if (error) {
      const err = new Error('TWO_FACTOR_REQUEST_FAILED');
      err.status = 500;
      throw err;
    }

    await EmailService.sendTwoFactorCode(adminEmail, code);
  }

  // UC-12 Alternative flow 1, step 2: verify the code matches, is unexpired, and unused.
  static async verifyCode(adminUserId, purpose, targetUserId, submittedCode) {
    const codeHash = hashCode(submittedCode);

    const { data, error } = await supabase
      .from('TwoFactorCode')
      .select('*')
      .eq('userId', adminUserId)
      .eq('purpose', purpose)
      .eq('targetUserId', targetUserId)
      .eq('codeHash', codeHash)
      .is('consumedAt', null)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const err = new Error('INVALID_TWO_FACTOR_CODE');
      err.status = 401;
      throw err;
    }

    if (new Date(data.expiresAt) < new Date()) {
      const err = new Error('TWO_FACTOR_CODE_EXPIRED');
      err.status = 401;
      throw err;
    }

    await supabase.from('TwoFactorCode').update({ consumedAt: new Date() }).eq('codeId', data.codeId);
    return true;
  }
}

module.exports = TwoFactorService;