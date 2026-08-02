class UserSession {
  constructor(sessionId, tokenHash, createdAt, expiresAt, revokedAt) {
    this.sessionId = sessionId;
    this.tokenHash = tokenHash;
    this.createdAt = createdAt || new Date();
    this.expiresAt = expiresAt;
    this.revokedAt = revokedAt || null;
  }

  isValid() {
    const now = new Date();
    return !this.revokedAt && this.expiresAt > now;
  }
}

module.exports = UserSession;