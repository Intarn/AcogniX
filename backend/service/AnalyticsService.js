const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class AnalyticsService {
  // UC-03: Track Active Study Time (Ping Mechanism)
  static async recordStudyPing(learnerId, courseId) {
    const now = new Date();
    const { data: recentSession, error: fetchError } = await supabase
      .from('Study_Session')
      .select('*')
      .eq('learnerId', learnerId)
      .order('endTime', { ascending: false }) 
      .limit(1)
      .maybeSingle();

    if (fetchError) throw new AppError(500, 'DB_ERROR', 'Failed to fetch recent study session.');

    if (recentSession && (now.getTime() - new Date(recentSession.endTime).getTime() <= 150000)) {
      // Resume and extend existing session
      const startTime = new Date(recentSession.startTime);
      const durationMinutes = Math.round((now - startTime) / 60000);
      
      const { error: updateError } = await supabase
        .from('Study_Session')
        .update({ endTime: now.toISOString(), durationMinutes })
        .eq('sessionId', recentSession.sessionId);
        
      if (updateError) throw new AppError(500, 'DB_ERROR', 'Failed to update study session.');
      return { status: 'extended', sessionId: recentSession.sessionId, durationMinutes };
    } else {
      // Create a new session after idle timeout or fresh start
      const { data: newSession, error: insertError } = await supabase
        .from('Study_Session')
        .insert([{ learnerId, courseId: courseId || null, startTime: now.toISOString(), endTime: now.toISOString(), durationMinutes: 0 }])
        .select()
        .single();
        
      if (insertError) throw new AppError(500, 'DB_ERROR', 'Failed to create new study session.');
      return { status: 'created', sessionId: newSession.sessionId, durationMinutes: 0 };
    }
  }

  // UC-04: View Personal Statistics (Learner)
  static async getPersonalStats(learnerId) {
    // 1. Fetch all study sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('Study_Session')
      .select('durationMinutes, startTime')
      .eq('learnerId', learnerId);
    if (sessionError) throw new AppError(500, 'DB_ERROR', 'Failed to fetch personal stats.');

    // 2. Fetch submissions to identify "Weak Topics/Revision Recommendations"
    const { data: submissions, error: subError } = await supabase
      .from('Submission')
      .select('score, Assessment(title, totalPoints)')
      .eq('learnerId', learnerId)
      .eq('status', 'GRADED');
    if (subError) throw new AppError(500, 'DB_ERROR', 'Failed to fetch submissions.');

    // Calculate totals & Trends
    const totalMinutes = (sessions || []).reduce((acc, curr) => acc + curr.durationMinutes, 0);
    const progressTrend = this._calculateWeeklyTrend(sessions); // Extension: Trend over last 7 days

    // Recommend revisions for assessments scoring below 50%
    const revisionRecommendations = (submissions || [])
      .filter(sub => (sub.score / sub.Assessment.totalPoints) < 0.5)
      .map(sub => sub.Assessment.title);

    return {
      totalStudyMinutes: totalMinutes,
      totalStudyHours: (totalMinutes / 60).toFixed(1),
      sessionsCount: sessions?.length || 0,
      progressTrend,
      revisionRecommendations: revisionRecommendations.length > 0 ? revisionRecommendations : ["Great job! No weak topics detected yet."]
    };
  }

  // UC-11: View Class Performance Statistics (Educator)
  static async getClassPerformance(courseId, educatorId) {
    // 1. Verify Course Ownership
    const { data: course, error: courseError } = await supabase.from('Course').select('educatorId').eq('courseId', courseId).single();
    if (courseError || !course) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
    if (course.educatorId !== educatorId) throw new AppError(403, 'FORBIDDEN', 'Access denied.');

    // 2. Fetch all enrolled students
    const { data: enrollments } = await supabase
      .from('Enrollment')
      .select('learnerId, User(displayName)')
      .eq('courseId', courseId)
      .eq('status', 'APPROVED');

    // 3. Fetch submissions for class average
    const { data: submissions } = await supabase
      .from('Submission')
      .select('score, learnerId, Assessment!inner(courseId, totalPoints)') 
      .eq('Assessment.courseId', courseId)
      .eq('status', 'GRADED');

    // 4. Fetch study sessions for this specific course
    const { data: studySessions } = await supabase
      .from('Study_Session')
      .select('learnerId, durationMinutes')
      .eq('courseId', courseId);

    // Aggregate Data
    const validScores = (submissions || []).filter(s => s.score !== null).map(s => s.score);
    const averageScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2) : 0;

    const studentPerformance = (enrollments || []).map(enroll => {
      const studentSubmissions = (submissions || []).filter(s => s.learnerId === enroll.learnerId);

      let avgStudentPercentage = 0;
      if (studentSubmissions.length > 0) {
          const totalPercentage = studentSubmissions.reduce((a, b) => {
            const max = b.Assessment?.totalPoints || 100;
            return a + (b.score / max);
          }, 0);
          avgStudentPercentage = totalPercentage / studentSubmissions.length;
      }

      const totalStudyTime = (studySessions || []).filter(s => s.learnerId === enroll.learnerId).reduce((a, b) => a + b.durationMinutes, 0);

      return {
        learnerId: enroll.learnerId,
        name: enroll.User?.displayName || 'Unknown',
        averageScore: avgStudentPercentage, 
        studyTimeMinutes: totalStudyTime,
        needsAttention: avgStudentPercentage < 0.5 || totalStudyTime === 0 // 0.5 tương đương 50%
      };
    });

    const atRiskStudents = studentPerformance.filter(s => s.needsAttention);

    return {
      totalGradedSubmissions: validScores.length,
      classAverageScore: Number(averageScore),
      atRiskStudents
    };
  }

  // Helper method for UC-04 trend chart
  static _calculateWeeklyTrend(sessions) {
    const trend = Array(7).fill(0); // Last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    (sessions || []).forEach(session => {
      const sessionDate = new Date(session.startTime);
      sessionDate.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(today - sessionDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays < 7) {
        trend[6 - diffDays] += session.durationMinutes; // 6 is today, 0 is 6 days ago
      }
    });
    return trend;
  }
}
module.exports = AnalyticsService;