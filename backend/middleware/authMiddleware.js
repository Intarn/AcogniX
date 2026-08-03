const AuthenticationService = require('../service/AuthenticationService');

// xác thực 
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const userData = await AuthenticationService.validateSession(token);
    req.user = userData;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Session expired or invalid. Please log in again." });
  }
}

// phân quyền 
function authorize(...allowedRoles) {
  return function roleAuthorization(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'INSUFFICIENT_ROLE',
        message: 'You are not authorized to perform this action.'
      });
    }
    return next();
  };
}

module.exports = {
  requireAuth, 
  authorize
};