const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class AnalyticsService {
  // UC-03: Track Active Study Time
  static async logStudySession(learnerId, courseId, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.round((end - start) / 60000);
    if (durationMinutes < 1) throw new AppError(400, 'SESSION_TOO_SHORT', 'Study session must be at least 1 minute long.');

    const { data, error } = await supabase
      .from('Study_Session')
      .insert([{ learnerId, courseId: courseId || null, startTime: start.toISOString(), endTime: end.toISOString(), durationMinutes }])
      .select().single();
    if (error) throw error;
    return data;
  }

  // UC-04: View Personal Statistics (Learner)
  static async getPersonalStats(learnerId) {
    const { data: sessions, error } = await supabase
      .from('Study_Session')
      .select('durationMinutes, courseId')
      .eq('learnerId', learnerId);
    
    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch personal stats.');

    const totalMinutes = (sessions || []).reduce((acc, curr) => acc + curr.durationMinutes, 0);
    
    return {
      totalStudyMinutes: totalMinutes,
      totalStudyHours: (totalMinutes / 60).toFixed(1),
      sessionsCount: sessions?.length || 0
    };
  }

  // UC-11: View Class Performance Statistics (Educator)
  static async getClassPerformance(courseId, educatorId) {
    // Check owner
    const { data: course, error: courseError } = await supabase.from('Course').select('educatorId').eq('courseId', courseId).single();
    if (courseError || !course) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
    if (course.educatorId !== educatorId) throw new AppError(403, 'FORBIDDEN', 'Access denied.');

    // Fetch submissions for this course (using inner join with Assessment)
    const { data: submissions, error: subError } = await supabase
      .from('Submission')
      .select('score, status, Assessment!inner(courseId)')
      .eq('Assessment.courseId', courseId)
      .eq('status', 'GRADED');

    if (subError) throw new AppError(500, 'DB_ERROR', 'Failed to fetch class performance.');

    const validScores = (submissions || []).filter(s => s.score !== null).map(s => s.score);
    const averageScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2) : 0;

    return {
      totalGradedSubmissions: validScores.length,
      averageScore: Number(averageScore)
    };
  }
}
module.exports = AnalyticsService;