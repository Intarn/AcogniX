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

    if (recentSession && (today.getTime() - new Date(recentSession.endTime).getTime() <= 120000)) {
      const startTime = new Date(recentSession.startTime);
      const durationMinutes = Math.round((today - startTime) / 60000);
      
      const { error: updateError } = await supabase
        .from('Study_Session')
        .update({ endTime: today.toISOString(), durationMinutes })
        .eq('sessionId', recentSession.sessionId);
        
      if (updateError) throw new AppError(500, 'DB_ERROR', 'Failed to update study session.');
      return { status: 'extended', sessionId: recentSession.sessionId, durationMinutes };
    } else {
      const { data: newSession, error: insertError } = await supabase
        .from('Study_Session')
        .insert([{ learnerId, courseId: courseId || null, startTime: today.toISOString(), endTime: today.toISOString(), durationMinutes: 0 }])
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

    // Null guards for Assessment
    const revisionRecommendations = (submissions || [])
      .filter(sub => {
         const maxPoints = sub.Assessment?.totalPoints || 100;
         return (sub.score / maxPoints) < 0.5;
      })
      .map(sub => sub.Assessment?.title || 'Unknown Assessment');

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
    const { data: submissions } = await supabase.from('Submission').select('score, learnerId, Assessment!inner(courseId, totalPoints)').eq('Assessment.courseId', courseId).eq('status', 'GRADED');
    const { data: studySessions } = await supabase.from('Study_Session').select('learnerId, durationMinutes').eq('courseId', courseId);

    // Aggregate Data
    const validScores = (submissions || []).filter(s => s.score !== null).map(s => s.score);
    const averageScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2) : 0;

    const classTotalPercentage = (submissions || []).reduce((acc, sub) => {
      const max = sub.Assessment?.totalPoints || 100;
      return acc + (sub.score / max);
    }, 0);
    const classAverageScore = submissions?.length > 0 ? ((classTotalPercentage / submissions.length) * 100).toFixed(1) : 0;

    const studentPerformance = (enrollments || []).map(enroll => {
      const studentSubmissions = (submissions || []).filter(s => s.learnerId === enroll.learnerId);
      
      let avgStudentPercentage = 0;
      if (studentSubmissions.length > 0) {
          const totalPercentage = studentSubmissions.reduce((a, b) => {
            const max = b.Assessment?.totalPoints || 100;
            return a + (b.score / max);
          }, 0);
          // Convert to 0-100 scale
          avgStudentPercentage = (totalPercentage / studentSubmissions.length) * 100;
      }

      const totalStudyTime = (studySessions || []).filter(s => s.learnerId === enroll.learnerId).reduce((a, b) => a + b.durationMinutes, 0);

      return {
        learnerId: enroll.learnerId,
        name: enroll.User?.displayName || 'Unknown',
        averageScore: avgStudentPercentage.toFixed(1), 
        studyTimeMinutes: totalStudyTime,
        needsAttention: avgStudentPercentage < 50 || totalStudyTime === 0 // Compare with 50%
      };
    });

    const atRiskStudents = studentPerformance.filter(s => s.needsAttention);

    return {
      totalGradedSubmissions: (submissions || []).length,
      classAverageScore: Number(classAverageScore),
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