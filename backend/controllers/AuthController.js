// src/controllers/AuthController.js
const AuthenticationService = require('../services/AuthenticationService');
const { UserRole } = require('../enums/AuthEnums');

class AuthController {
  
  static async register(req, res) {
    const { email, password, displayName, role } = req.body;
    
    // Alternative Flow 1 & 4 (UC-22)
    if (!email || !password || !displayName || !role) {
      return res.status(400).json({ message: "Please complete all required fields." }); //[cite: 2]
    }
    if (![UserRole.LEARNER, UserRole.EDUCATOR].includes(role)) {
      return res.status(400).json({ message: "Please select either Learner or Educator." }); //[cite: 2]
    }

    try {
      const user = await AuthenticationService.signUp(email, password, displayName, role);
      return res.status(201).json({ message: "Your account has been created successfully.", user }); //[cite: 2]
    } catch (error) {
      if (error.message.includes("already registered") || error.status === 422) {
        return res.status(409).json({ message: "This email address is already registered." }); //[cite: 2]
      }
      return res.status(500).json({ message: "Unable to create your account. Please try again." }); //[cite: 2]
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    
    // Alternative Flow 1 (UC-23)
    if (!email || !password) return res.status(400).json({ message: "Please enter your email and password." }); //[cite: 2]

    try {
      const session = await AuthenticationService.logIn(email, password);
      
      let redirectUrl = '/';
      if (session.userRole === UserRole.LEARNER) redirectUrl = '/learner-dashboard';
      else if (session.userRole === UserRole.EDUCATOR) redirectUrl = '/educator-dashboard';
      else if (session.userRole === UserRole.SYSTEM_ADMINISTRATOR) redirectUrl = '/admin-portal'; //[cite: 2]

      return res.status(200).json({ message: "Login successful", token: session.tokenHash, redirectTo: redirectUrl });
    } catch (error) {
      if (error.message === 'BANNED_ACCOUNT') {
        return res.status(403).json({ message: "Your account has been banned. Please contact the System Administrator for assistance." }); //[cite: 2]
      }
      return res.status(401).json({ message: "Incorrect email or password." }); //[cite: 2]
    }
  }

  static async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      await AuthenticationService.logOut(token);
      return res.status(200).json({ message: "Logged out successfully", redirectTo: "/login" }); //[cite: 2]
    } catch (error) {
      return res.status(500).json({ message: "Error during logout, please clear client session." });
    }
  }
}

module.exports = AuthController;