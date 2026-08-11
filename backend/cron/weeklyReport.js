const cron = require('node-cron');
const supabase = require('../config/supabaseClient');
const AnalyticsService = require('../service/AnalyticsService');
const EmailService = require('../service/EmailService');

// Sleep function for exponential backoff
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry logic for Email
const sendEmailWithRetry = async (to, subject, html, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await EmailService.send(to, subject, html);
      return; 
    } catch (error) {
      if (i === retries - 1) throw error; 
      console.warn(`[CRON] Email retry ${i + 1}/${retries} failed. Retrying in ${2 * (i + 1)}s...`);
      await sleep(2000 * (i + 1)); 
    }
  }
};

// Run at 23:59 every Sunday ('59 23 * * 0')
const scheduleWeeklyReports = () => {
  if (process.env.NODE_ENV !== 'production') {
      console.log('[CRON] Skipping weekly reports schedule in non-production environment.');
      return;
  }
  
  cron.schedule('59 23 * * 0', async () => {
    console.log('[CRON] Starting automated weekly class performance reports...');
    try {
      // 1. Get all active courses
      const { data: courses } = await supabase.from('Course').select('courseId, educatorId, subjectName').eq('status', 'ACTIVE');
      
      if (!courses) return;

      for (const course of courses) {
        try {
          const performance = await AnalyticsService.getClassPerformance(course.courseId, course.educatorId);
          const { data: educator } = await supabase.from('User').select('email').eq('userId', course.educatorId).single();
          
          if (educator && educator.email) {
            const htmlReport = `
              <h2>Weekly Performance Report: ${course.subjectName}</h2>
              <p><strong>Class Average Score:</strong> ${performance.classAverageScore}%</p>
              <p><strong>Total Submissions Graded:</strong> ${performance.totalGradedSubmissions}</p>
              <br>
              <h3>Students Requiring Attention</h3>
              <ul>
                ${performance.atRiskStudents.length > 0 
                  ? performance.atRiskStudents.map(s => `<li>${s.name} - Avg Score: ${s.averageScore}% - Study Time: ${s.studyTimeMinutes} mins</li>`).join('') 
                  : '<li>All students are performing well.</li>'}
              </ul>
              <p>Log in to AcogniX to view detailed insights.</p>
            `;
            
            await sendEmailWithRetry(educator.email, `Weekly Report: ${course.subjectName}`, htmlReport);
          }
        } catch (courseError) {
            console.error(`[CRON] Failed to send report for course ${course.courseId}:`, courseError);
        }
      }
    } catch (error) { 
        console.error('[CRON] Failed to execute weekly reports:', error);
    }
  });
};

module.exports = scheduleWeeklyReports;