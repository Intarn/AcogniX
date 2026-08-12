const AnalyticsService = require('../service/AnalyticsService');

function handleControllerError(error, res) {
  if (error.statusCode) return res.status(error.statusCode).json({ code: error.code, message: error.message });
  console.error(error);
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class AnalyticsController {
  static async pingSession(req, res) {
    try {
      const { courseId } = req.body; 
      const result = await AnalyticsService.recordStudyPing(req.user.userId, courseId);
      
      const io = req.app.get('io');
      if (io) {
          io.emit('study_ping_updated', { userId: req.user.userId, data: result });
      }

      return res.status(200).json({ message: 'Study time tracked successfully.', data: result });
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