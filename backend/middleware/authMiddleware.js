const AuthenticationService = require('../service/AuthenticationService');

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

module.exports = requireAuth;