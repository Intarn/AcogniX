const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class AnalyticsService {
    static async logStudySession(learnerId, courseId, startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationMinutes = Math.round((end - start) / 60000);

        if (durationMinutes < 1) {
            throw new AppError(400, 'SESSION_TOO_SHORT', 'Study session must be at least 1 minute long.');
        }

        const { data, error } = await supabase
            .from('Study_Session')
            .insert([{ 
                learnerId, 
                courseId: courseId || null, 
                startTime: start.toISOString(), 
                endTime: end.toISOString(), 
                durationMinutes 
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = AnalyticsService;