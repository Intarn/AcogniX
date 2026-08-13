const InfrastructureService = require('../service/InfrastructureService');

function handleControllerError(error, res) {
  if (error.statusCode) {
     return res.status(error.statusCode).json({ code: error.code, message: error.message });
  }
  console.error(error);
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class InfrastructureController {
  static async getHealth(req, res) {
    try {
      const health = await InfrastructureService.getSystemHealth();
      return res.status(200).json(health);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async getPlatformAnalytics(req, res) {
    try {
      const analytics = await InfrastructureService.getPlatformAnalytics();
      return res.status(200).json(analytics);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async getApiUsage(req, res) {
    try {
      const usage = await InfrastructureService.getLLMUsage();
      return res.status(200).json(usage);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async updateKey(req, res) {
    try {
      const result = await InfrastructureService.updateAPIKey(req.body.apiKey);
      return res.status(200).json(result);
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}
module.exports = InfrastructureController;