const { UserRole, AccountStatus } = require('../enums/AuthEnums');

class User {
  constructor(userId, email, passwordHash, displayName, avatarUrl, role, status, createdAt, updatedAt) {
    this.userId = userId;
    this.email = email;
    this.passwordHash = passwordHash; 
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.role = role || UserRole.LEARNER;
    this.status = status || AccountStatus.ACTIVE;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  isActive() {
    return this.status === AccountStatus.ACTIVE;
  }
}

module.exports = User;