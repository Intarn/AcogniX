const AuthenticationService = require('../services/AuthenticationService');
const { UserRole } = require('../enums/AuthEnums');
const User = require('../entities/User');

// Alternative flow 2 (UC-22): Regex check email format
class AuthController {
  
  static async register(req, res) {
    const { email, password, displayName, role } = req.body;
    
    // Basic Flow #5 (UC-22)
    if (!email || !password || !displayName || !role) {
      return res.status(400).json({ message: "Please complete all required fields." }); 
    }

    // Basic Flow #6 / Alternative flow 2 (UC-22)
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    // Basic Flow #8 / Alternative flow 4 (UC-22)
    if (![UserRole.LEARNER, UserRole.EDUCATOR].includes(role)) {
      return res.status(400).json({ message: "Please select either Learner or Educator." }); 
    }

    try {
      const user = await AuthenticationService.signUp(email, password, displayName, role);

      // Basic Flow #11 (UC-22) 
      return res.status(201).json({ 
        message: "Your account has been created successfully.", 
        user,
        redirectTo: "/login" 
      }); 
    } catch (error) {
      if (error.message === 'EMAIL_ALREADY_RESGISTERED') {
        return res.status(409).json({ message: "This email address is already registered." }); // Alternatvie flow 3
      }
      return res.status(500).json({ message: "Unable to create your account. Please try again." }); 
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    
    // Basic Flow #5 / Alternative flow 1 (UC-23)
    if (!email || !password) {
      return res.status(400).json({ message: "Please enter your email and password." }); 
    }

    try {
      const session = await AuthenticationService.logIn(email, password);
      
      let redirectUrl = '/';
      if (session.userRole === UserRole.LEARNER) redirectUrl = '/learner-dashboard';
      else if (session.userRole === UserRole.EDUCATOR) redirectUrl = '/educator-dashboard';
      else if (session.userRole === UserRole.SYSTEM_ADMINISTRATOR) redirectUrl = '/admin-portal'; 

      return res.status(200).json({ message: "Login successful", token: session.tokenHash, redirectTo: redirectUrl });
    } catch (error) {
      if (error.message === 'BANNED_ACCOUNT') {
        return res.status(403).json({ message: "Your account has been banned. Please contact the System Administrator for assistance." }); // Alternative flow 3
      }

      if (error.message === 'SESSION_CREATION_FAILED') {
        return res.status(500).json({ message: "Your account has been banned. Please contact the System Administrator for assistance." }); // Alternative flow 3
      }

      return res.status(401).json({ message: "Incorrect email or password." }); // Alternative flow 2
    }
  }

  static async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Authentication required." });
      }
      await AuthenticationService.logOut(token);
      return res.status(200).json({ message: "Logged out successfully", redirectTo: "/login" }); 
    } catch (error) {
      return res.status(500).json({ message: "Error during logout, please clear client session." });
    }
  }
}

module.exports = AuthController;