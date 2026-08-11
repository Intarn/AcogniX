const cron = require('node-cron');
const supabase = require('../config/supabaseClient');
const AnalyticsService = require('../service/AnalyticsService');
const EmailService = require('../service/EmailService');

// Run at 23:59 every Sunday ('59 23 * * 0')
const scheduleWeeklyReports = () => {
  cron.schedule('59 23 * * 0', async () => {
    console.log('[CRON] Starting automated weekly class performance reports...');
    try {
      // 1. Get all active courses
      const { data: courses } = await supabase.from('Course').select('courseId, educatorId, subjectName').eq('status', 'ACTIVE');
      
      if (!courses) return;

      for (const course of courses) {
        // 2. Fetch performance data for the course
        const performance = await AnalyticsService.getClassPerformance(course.courseId, course.educatorId);
        
        // 3. Find the educator's email
        const { data: educator } = await supabase.from('User').select('email').eq('userId', course.educatorId).single();

        if (educator && educator.email) {
          // 4. Send email notification (UC-11 Alt Flow 1)
          const htmlReport = `
            <h2>Weekly Performance Report: ${course.subjectName}</h2>
            <p><strong>Class Average Score:</strong> ${performance.classAverageScore}</p>
            <p><strong>Total Submissions Graded:</strong> ${performance.totalGradedSubmissions}</p>
            <br>
            <h3>Students Requiring Attention</h3>
            <ul>
              ${performance.atRiskStudents.length > 0 
                ? performance.atRiskStudents.map(s => `<li>${s.name} - Avg Score: ${s.averageScore} - Study Time: ${s.studyTimeMinutes} mins</li>`).join('') 
                : '<li>All students are performing well.</li>'}
            </ul>
            <p>Log in to AcogniX to view detailed insights.</p>
          `;
          
          await EmailService.send(educator.email, `Weekly Report: ${course.subjectName}`, htmlReport);
        }
      }
      console.log('[CRON] Weekly reports sent successfully.');
    } catch (error) {
      console.error('[CRON] Failed to execute weekly reports:', error);
    }
  });
};

module.exports = scheduleWeeklyReports;