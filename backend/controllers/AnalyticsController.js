// backend/controllers/AnalyticsController.js
const AnalyticsService = require('../service/AnalyticsService');
const NotificationService = require('../service/NotificationService');

function handleControllerError(error, res) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ code: error.code, message: error.message });
  }
  console.error(error);
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class AnalyticsController {
  static async pingSession(req, res) {
    try {
      const result = await AnalyticsService.recordStudyCheckpoint(req.user.userId, req.body || {});

      const io = req.app.get('io');
      if (io) {
        io.emit('study_ping_updated', { userId: req.user.userId, data: result });
      }
      return res.status(200).json({ message: 'Study time tracked successfully.', data: result });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  // UC-04: Supports predefined ranges and a learner-selected custom date range.
  static async getPersonalStats(req, res) {
    try {
      const timeRange = req.query.timeRange || 'Last 7 days';
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      const stats = await AnalyticsService.getPersonalStats(
        req.user.userId,
        timeRange,
        startDate,
        endDate
      );
      return res.status(200).json(stats);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }



  static async getEducatorNotifications(req, res) {
    try {
      const result = await NotificationService.getEducatorNotifications(req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async markEducatorNotificationRead(req, res) {
    try {
      const result = await NotificationService.markEducatorNotificationRead(
        req.user.userId,
        req.params.notificationId
      );
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getWeeklyClassPerformance(req, res) {
    try {
      const report = await AnalyticsService.getWeeklyReport(req.params.courseId, req.user.userId);
      return res.status(200).json(report);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  // Authorized scheduler simulation for UC11 test environments.
  // Ownership is still enforced by AnalyticsService.
  static async generateWeeklyClassPerformance(req, res) {
    try {
      const report = await AnalyticsService.generateWeeklyReport(
        req.params.courseId,
        req.user.userId,
        req.body?.generatedAt || new Date()
      );
      return res.status(201).json({
        message: 'Weekly class-performance report generated successfully.',
        report
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  // UC-11: Thống kê hiệu suất học tập lớp học cho Giảng viên
  static async getClassPerformance(req, res) {
    try {
      const stats = await AnalyticsService.getClassPerformance(req.params.courseId, req.user.userId);
      return res.status(200).json(stats);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
}

module.exports = AnalyticsController;