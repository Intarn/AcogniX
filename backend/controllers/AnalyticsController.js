const AnalyticsService = require('../service/AnalyticsService');

function handleControllerError(error, res) {
  if (error.statusCode) return res.status(error.statusCode).json({ code: error.code, message: error.message });
  console.error(error);
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class AnalyticsController {
  static async logSession(req, res) {
    try {
      const { courseId, startTime, endTime } = req.body;
      const session = await AnalyticsService.logStudySession(req.user.userId, courseId, startTime, endTime);
      return res.status(201).json({ message: 'Study session logged successfully.', data: session });
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async getPersonalStats(req, res) {
    try {
      const stats = await AnalyticsService.getPersonalStats(req.user.userId);
      return res.status(200).json(stats);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async getClassPerformance(req, res) {
    try {
      const stats = await AnalyticsService.getClassPerformance(req.params.courseId, req.user.userId);
      return res.status(200).json(stats);
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}
module.exports = AnalyticsController;