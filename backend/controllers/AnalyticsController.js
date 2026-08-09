const AnalyticsService = require('../service/AnalyticsService');

function handleControllerError(error, res) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({ code: error.code, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class AnalyticsController {
    static async logSession(req, res) {
        try {
            const { courseId, startTime, endTime } = req.body;
            if (!startTime || !endTime) {
                return res.status(400).json({ code: 'MISSING_DATA', message: 'Both startTime and endTime are required.' });
            }
            
            const session = await AnalyticsService.logStudySession(req.user.userId, courseId, startTime, endTime);
            return res.status(201).json({ message: 'Study session logged successfully.', data: session });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }
}

module.exports = AnalyticsController;