const cron = require('node-cron');
const supabase = require('../config/supabaseClient');
const AnalyticsService = require('../service/AnalyticsService');
const EmailService = require('../service/EmailService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let scheduledTask = null;

const sendEmailWithRetry = async (to, subject, html, retries = 3) => {
  for (let i = 0; i < retries; i += 1) {
    try {
      await EmailService.send(to, subject, html);
      return { sent: true };
    } catch (error) {
      if (i === retries - 1) {
        console.error('[CRON] Weekly-report email delivery failed after retries:', error);
        return { sent: false, error: error.message || 'EMAIL_SEND_FAILED' };
      }
      console.warn(`[CRON] Email retry ${i + 1}/${retries} failed.`);
      await sleep(2000 * (i + 1));
    }
  }
  return { sent: false };
};

// Shared implementation used by the real schedule and by controlled tests.
// The report is persisted before email delivery, so an email failure does not
// remove the in-app weekly notification or detailed report.
const runWeeklyReportsNow = async (generatedAt = new Date()) => {
  console.log('[CRON] Starting automated weekly class performance reports...');

  const { data: courses, error: courseError } = await supabase
    .from('Course')
    .select('courseId, educatorId, subjectName')
    .eq('status', 'ACTIVE');

  if (courseError) throw courseError;

  const results = [];

  for (const course of courses || []) {
    try {
      const report = await AnalyticsService.generateWeeklyReport(
        course.courseId,
        course.educatorId,
        generatedAt
      );

      const { data: educator, error: educatorError } = await supabase
        .from('User')
        .select('email')
        .eq('userId', course.educatorId)
        .maybeSingle();

      if (educatorError) throw educatorError;

      let emailResult = { sent: false, reason: 'NO_EDUCATOR_EMAIL' };
      if (educator?.email) {
        const stats = report.stats;
        const htmlReport = `
          <div style="font-family: Arial, sans-serif;">
            <h2>Weekly Performance Report: ${course.subjectName}</h2>
            <p><strong>Class Average Score:</strong> ${stats.avgAssessmentScore}</p>
            <p><strong>Active Study Time:</strong> ${stats.activeStudyTime}</p>
            <p><strong>Total Graded Submissions:</strong> ${stats.totalGradedSubmissions}</p>
            <h3>Students Requiring Attention</h3>
            <ul>
              ${stats.atRiskStudents.length > 0
                ? stats.atRiskStudents
                  .map(s => `<li>${s.name} - ${s.averageScore == null ? 'No score' : `${s.averageScore}%`} - ${s.studyTimeMinutes} mins studied</li>`)
                  .join('')
                : '<li>All students are currently meeting expectations.</li>'}
            </ul>
            <p>Open AcogniX notifications to view the detailed weekly insights.</p>
          </div>
        `;

        emailResult = await sendEmailWithRetry(
          educator.email,
          `Weekly Report: ${course.subjectName}`,
          htmlReport
        );
      }

      results.push({
        courseId: course.courseId,
        reportId: report.reportId,
        generated: true,
        emailSent: Boolean(emailResult.sent)
      });
    } catch (courseError) {
      console.error(`[CRON] Failed to generate report for course ${course.courseId}:`, courseError);
      results.push({
        courseId: course.courseId,
        generated: false,
        error: courseError.message || 'WEEKLY_REPORT_FAILED'
      });
    }
  }

  return results;
};

// Generate before the test-case deadline of 23:59 Sunday. The timezone can be
// overridden without changing code when the deployment is outside Vietnam.
const scheduleWeeklyReports = () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[CRON] Weekly scheduler disabled outside production; use the authorized UC11 simulation endpoint when testing.');
    return null;
  }
  if (scheduledTask) return scheduledTask;

  scheduledTask = cron.schedule(
    '55 23 * * 0',
    () => runWeeklyReportsNow().catch(error => {
      console.error('[CRON] Failed to execute weekly reports:', error);
    }),
    { timezone: process.env.WEEKLY_REPORT_TIMEZONE || 'Asia/Ho_Chi_Minh' }
  );

  return scheduledTask;
};

scheduleWeeklyReports.runNow = runWeeklyReportsNow;
module.exports = scheduleWeeklyReports;
