const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function encryptionKey() {
  const raw = String(process.env.SYSTEM_SETTINGS_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    const error = new Error('SYSTEM_SETTINGS_ENCRYPTION_KEY is required to protect sensitive settings.');
    error.code = 'SECRET_ENCRYPTION_NOT_CONFIGURED';
    throw error;
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptSecret(value) {
  const plain = String(value || '');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptSecret(value) {
  const stored = String(value || '');
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext; rewritten encrypted on next update
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Encrypted setting has an invalid format.');
  const [ivB64, tagB64, cipherB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
