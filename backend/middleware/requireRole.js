const supabase = require('../config/supabaseClient');

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const authUserId = req.user?.user?.id;
      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const { data: profile, error } = await supabase
        .from('User')
        .select('role, status')
        .eq('userId', authUserId)
        .single();

      if (error || !profile) {
        return res.status(401).json({ message: "User profile not found." });
      }

      if (profile.status === 'BANNED') {
        return res.status(403).json({ message: "Your account has been banned." });
      }

      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ message: "You do not have permission to perform this action." });
      }

      req.userRole = profile.role;
      req.userId = authUserId;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Unable to verify permissions." });
    }
  };
}

module.exports = requireRole;