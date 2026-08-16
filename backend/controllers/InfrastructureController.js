const InfrastructureService = require('../service/InfrastructureService');

function handleControllerError(error, res) {
  InfrastructureService.recordServerError(error, 'Infrastructure API');
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
      return handleControllerError(error, res);
    }
  }

  static async getPlatformAnalytics(req, res) {
    try {
      const analytics = await InfrastructureService.getPlatformAnalytics();
      return res.status(200).json(analytics);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getApiUsage(req, res) {
    try {
      const usage = await InfrastructureService.getLLMUsage();
      return res.status(200).json(usage);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async updateKey(req, res) {
    try {
      const result = await InfrastructureService.updateAPIKey(req.body.apiKey);
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async restartDatabase(req, res) {
    try {
      const result = await InfrastructureService.restartDatabaseConnection();
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getErrorLogs(req, res) {
    try {
      const logs = await InfrastructureService.getErrorLogs(req.query.limit);
      return res.status(200).json({ logs, retrievedAt: new Date().toISOString() });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  // Test setup helpers for UC18 alternative-flow execution. They are disabled in production.
  static async simulateDatabaseFailure(req, res) {
    try {
      return res.status(200).json(InfrastructureService.simulateDatabaseFailure());
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async simulateQuotaExceeded(req, res) {
    try {
      return res.status(200).json(InfrastructureService.simulateQuotaExceeded());
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
}

module.exports = InfrastructureController;
