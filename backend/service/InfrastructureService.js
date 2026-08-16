const os = require('os');
const fs = require('fs');
const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');


const MAX_ERROR_LOGS = 100;
const recentErrorLogs = [];
let forceDatabaseFailure = process.env.INFRASTRUCTURE_FORCE_DB_OFFLINE === 'true';
let forceQuotaWarning = process.env.INFRASTRUCTURE_FORCE_QUOTA_WARNING === 'true';
const DAILY_TOKEN_QUOTA = Number(process.env.LLM_DAILY_TOKEN_QUOTA || 100000);

function recordServerError(error, context = 'Server') {
  const message = error?.message || String(error || 'Unknown server error');
  const code = error?.code || error?.statusCode || 'SERVER_ERROR';
  const now = Date.now();
  const duplicate = recentErrorLogs.find(entry =>
    entry.context === context && entry.code === String(code) && entry.message === message && now - new Date(entry.timestamp).getTime() < 60000
  );
  if (duplicate) return duplicate;

  const entry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(now).toISOString(),
    level: 'ERROR',
    context,
    code: String(code),
    message,
    details: error?.stack ? String(error.stack).split('\n').slice(0, 3).join(' | ') : null
  };
  recentErrorLogs.unshift(entry);
  if (recentErrorLogs.length > MAX_ERROR_LOGS) recentErrorLogs.length = MAX_ERROR_LOGS;
  return entry;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const NETWORK_ERROR_PATTERNS = [
  /fetch failed/i,
  /networkerror/i,
  /enotfound/i,
  /etimedout/i,
  /econnreset/i,
  /econnrefused/i,
  /socket hang up/i,
  /failed to fetch/i,
  /dns/i,
  /timeout/i
];

function isNetworkError(error) {
  const message = error?.message || JSON.stringify(error || '');
  return NETWORK_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfDaysAgo(days, date = new Date()) {
  const result = startOfDay(date);
  result.setDate(result.getDate() - days);
  return result;
}

async function countSince(table, field, since, extraFilters = []) {
  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte(field, since.toISOString());

  for (const filter of extraFilters) {
    query = filter(query);
  }

  const { count, error } = await query;
  if (error) throw error;
  return formatCount(count);
}

class InfrastructureService {
  // UC18: Monitor server resources and the actual Supabase connectivity state.
  static async getSystemHealth() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = Math.max(0, totalMem - freeMem);

    let cpuLoadPercentage = 0;
    const cpuCount = Math.max(os.cpus()?.length || 1, 1);

    if (os.platform() === 'win32') {
      const cpus = os.cpus();
      const usage = cpus.length > 0
        ? cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            return acc + (total > 0 ? (total - cpu.times.idle) / total : 0);
          }, 0) / cpus.length
        : 0;
      cpuLoadPercentage = Math.min(100, Math.max(0, usage * 100));
    } else {
      // loadavg is a system-wide load figure, so normalize it by logical CPUs.
      const oneMinuteLoad = os.loadavg()?.[0] || 0;
      cpuLoadPercentage = Math.min(100, Math.max(0, (oneMinuteLoad / cpuCount) * 100));
    }

    let databaseStatus = 'ONLINE';
    let databaseReachable = true;
    let databaseQueryOk = true;
    let databaseLatencyMs = null;
    let databaseError = null;
    let databaseErrorDetail = null;

    const startedAt = Date.now();
    try {
      if (forceDatabaseFailure) {
        const simulated = new Error('Connection Timeout');
        simulated.code = 'DB_CONNECTION_TIMEOUT';
        throw simulated;
      }

      const { error } = await supabase
        .from('User')
        .select('userId')
        .limit(1);

      databaseLatencyMs = Date.now() - startedAt;

      if (error) {
        databaseQueryOk = false;
        databaseErrorDetail = error.message || 'Supabase query failed.';
        databaseReachable = !isNetworkError(error);
        databaseStatus = databaseReachable ? 'DEGRADED' : 'OFFLINE';
        databaseError = databaseReachable ? databaseErrorDetail : 'Connection Timeout';
        recordServerError(error, 'Database Health Check');
      }
    } catch (error) {
      databaseLatencyMs = Date.now() - startedAt;
      databaseQueryOk = false;
      databaseErrorDetail = error?.message || 'Unable to reach Supabase.';
      databaseError = 'Connection Timeout';
      databaseReachable = false;
      databaseStatus = 'OFFLINE';
      recordServerError(error, 'Database Health Check');
    }

    return {
      os: os.type(),
      platform: os.platform(),
      cpuCount,
      uptimeSeconds: os.uptime(),
      checkedAt: new Date().toISOString(),
      ram: {
        totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        freeGB: (freeMem / 1024 / 1024 / 1024).toFixed(2),
        usagePercentage: ((usedMem / totalMem) * 100).toFixed(1)
      },
      cpuLoad: Number(cpuLoadPercentage.toFixed(2)),
      databaseStatus,
      databaseReachable,
      databaseQueryOk,
      databaseLatencyMs,
      databaseError,
      databaseErrorDetail
    };
  }

  // UC18: Actual platform-wide analytics aggregated from the same Supabase tables
  // that the application writes to during normal usage.
  static async getPlatformAnalytics() {
    const now = new Date();
    const today = startOfDay(now);
    const sevenDaysAgo = startOfDaysAgo(6, now);
    const activeLearnerSince = new Date(now.getTime() - 15 * 60 * 1000);

    const [
      totalUsersResult,
      activeUsersResult,
      activeCoursesResult,
      approvedEnrollmentsResult,
      studyTodayResult,
      aiChatTodayResult,
      quizzesTodayResult,
      flashcardsTodayResult,
      submissionsTodayResult,
      supportTicketsTodayResult,
      usersTrend,
      studyTrend,
      aiChatTrend,
      quizTrend,
      flashcardTrend,
      courses,
      enrollments,
      studySessions
    ] = await Promise.all([
      supabase.from('User').select('userId', { count: 'exact', head: true }),
      supabase.from('Study_Session').select('learnerId').gte('endTime', activeLearnerSince.toISOString()),
      supabase.from('Course').select('courseId', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('Enrollment').select('enrollmentId', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('Study_Session').select('durationMinutes, courseId').gte('startTime', today.toISOString()),
      supabase.from('Chat_Message').select('messageId', { count: 'exact', head: true }).gte('createdAt', today.toISOString()).eq('senderRole', 'AI_TUTOR'),
      supabase.from('Practice_Quiz').select('quizId', { count: 'exact', head: true }).gte('generatedAt', today.toISOString()),
      supabase.from('Flashcard_Set').select('flashcardSetId', { count: 'exact', head: true }).gte('generatedAt', today.toISOString()),
      supabase.from('Submission').select('submissionId', { count: 'exact', head: true }).gte('submittedAt', today.toISOString()),
      supabase.from('Support_Ticket').select('ticketId', { count: 'exact', head: true }).gte('createdAt', today.toISOString()),
      supabase.from('User').select('userId, createdAt').gte('createdAt', sevenDaysAgo.toISOString()),
      supabase.from('Study_Session').select('startTime, durationMinutes').gte('startTime', sevenDaysAgo.toISOString()),
      supabase.from('Chat_Message').select('createdAt').gte('createdAt', sevenDaysAgo.toISOString()).eq('senderRole', 'AI_TUTOR'),
      supabase.from('Practice_Quiz').select('generatedAt').gte('generatedAt', sevenDaysAgo.toISOString()),
      supabase.from('Flashcard_Set').select('generatedAt').gte('generatedAt', sevenDaysAgo.toISOString()),
      supabase.from('Course').select('courseId, courseCode, subjectName, status').eq('status', 'ACTIVE'),
      supabase.from('Enrollment').select('courseId, learnerId').eq('status', 'APPROVED'),
      supabase.from('Study_Session').select('courseId, learnerId, durationMinutes').gte('startTime', sevenDaysAgo.toISOString())
    ]);

    const queryResults = [
      totalUsersResult,
      activeUsersResult,
      activeCoursesResult,
      approvedEnrollmentsResult,
      studyTodayResult,
      aiChatTodayResult,
      quizzesTodayResult,
      flashcardsTodayResult,
      submissionsTodayResult,
      supportTicketsTodayResult,
      usersTrend,
      studyTrend,
      aiChatTrend,
      quizTrend,
      flashcardTrend,
      courses,
      enrollments,
      studySessions
    ];

    const firstError = queryResults.find(result => result?.error)?.error;
    if (firstError) {
      throw new AppError(500, 'DB_ERROR', `Failed to retrieve platform analytics: ${firstError.message}`);
    }

    const uniqueActiveLearners = new Set((activeUsersResult.data || []).map(row => row.learnerId));
    const studyTodayMinutes = (studyTodayResult.data || []).reduce(
      (total, row) => total + Number(row.durationMinutes || 0),
      0
    );

    const dailyBuckets = Array.from({ length: 7 }, (_, index) => {
      const date = startOfDaysAgo(6 - index, now);
      return {
        date: date.toISOString().slice(0, 10),
        users: 0,
        studyMinutes: 0,
        aiRequests: 0
      };
    });
    const bucketMap = new Map(dailyBuckets.map(bucket => [bucket.date, bucket]));

    for (const row of usersTrend.data || []) {
      const bucket = bucketMap.get(new Date(row.createdAt).toISOString().slice(0, 10));
      if (bucket) bucket.users += 1;
    }
    for (const row of studyTrend.data || []) {
      const bucket = bucketMap.get(new Date(row.startTime).toISOString().slice(0, 10));
      if (bucket) bucket.studyMinutes += Number(row.durationMinutes || 0);
    }
    for (const row of [...(aiChatTrend.data || [])]) {
      const bucket = bucketMap.get(new Date(row.createdAt).toISOString().slice(0, 10));
      if (bucket) bucket.aiRequests += 1;
    }
    for (const row of [...(quizTrend.data || []), ...(flashcardTrend.data || [])]) {
      const sourceDate = row.generatedAt;
      const bucket = bucketMap.get(new Date(sourceDate).toISOString().slice(0, 10));
      if (bucket) bucket.aiRequests += 1;
    }

    const enrollmentCountByCourse = new Map();
    for (const row of enrollments.data || []) {
      enrollmentCountByCourse.set(
        row.courseId,
        (enrollmentCountByCourse.get(row.courseId) || 0) + 1
      );
    }

    const studyMinutesByCourse = new Map();
    for (const row of studySessions.data || []) {
      studyMinutesByCourse.set(
        row.courseId,
        (studyMinutesByCourse.get(row.courseId) || 0) + Number(row.durationMinutes || 0)
      );
    }

    const topCourses = (courses.data || [])
      .map(course => ({
        courseId: course.courseId,
        code: course.courseCode || 'N/A',
        name: course.subjectName || 'Unnamed Course',
        students: enrollmentCountByCourse.get(course.courseId) || 0,
        studyMinutesLast7Days: studyMinutesByCourse.get(course.courseId) || 0
      }))
      .sort((a, b) => {
        if (b.studyMinutesLast7Days !== a.studyMinutesLast7Days) {
          return b.studyMinutesLast7Days - a.studyMinutesLast7Days;
        }
        return b.students - a.students;
      })
      .slice(0, 5);

    const aiRequestsToday = formatCount(aiChatTodayResult.count)
      + formatCount(quizzesTodayResult.count)
      + formatCount(flashcardsTodayResult.count);

    // Gemini responses are not currently persisted with token-usage metadata.
    // Keep this explicitly labelled as an estimate rather than presenting it as exact billing usage.
    const estimatedTokensConsumed =
      formatCount(aiChatTodayResult.count) * 150
      + formatCount(quizzesTodayResult.count) * 800
      + formatCount(flashcardsTodayResult.count) * 600;

    return {
      generatedAt: new Date().toISOString(),
      overview: {
        totalUsers: formatCount(totalUsersResult.count),
        activeLearnersLast15Minutes: uniqueActiveLearners.size,
        activeCourses: formatCount(activeCoursesResult.count),
        approvedEnrollments: formatCount(approvedEnrollmentsResult.count),
        studyMinutesToday: studyTodayMinutes,
        gradedOrSubmittedToday: formatCount(submissionsTodayResult.count),
        supportTicketsCreatedToday: formatCount(supportTicketsTodayResult.count)
      },
      activityTrend: dailyBuckets,
      topCourses,
      aiUsage: {
        requestsToday: aiRequestsToday,
        chatResponsesToday: formatCount(aiChatTodayResult.count),
        quizzesGeneratedToday: formatCount(quizzesTodayResult.count),
        flashcardSetsGeneratedToday: formatCount(flashcardsTodayResult.count),
        estimatedTokensConsumed,
        tokensConsumed: estimatedTokensConsumed,
        tokenUsageIsEstimated: true,
        quotaWarning: forceQuotaWarning || estimatedTokensConsumed >= DAILY_TOKEN_QUOTA,
        quotaReference: DAILY_TOKEN_QUOTA
      }
    };
  }

  // UC18: Legacy endpoint retained for the existing Dashboard widget.
  static async getLLMUsage() {
    const today = startOfDay();

    const [chatResult, quizResult, flashcardResult] = await Promise.all([
      countSince('Chat_Message', 'createdAt', today, [query => query.eq('senderRole', 'AI_TUTOR')]),
      countSince('Practice_Quiz', 'generatedAt', today),
      countSince('Flashcard_Set', 'generatedAt', today)
    ]);

    const estimatedTokens = (chatResult * 150) + (quizResult * 800) + (flashcardResult * 600);

    return {
      apiRequestsToday: chatResult + quizResult + flashcardResult,
      chatResponsesToday: chatResult,
      quizzesGeneratedToday: quizResult,
      flashcardSetsGeneratedToday: flashcardResult,
      estimatedTokensConsumed: estimatedTokens,
      tokenUsageIsEstimated: true,
      tokensConsumed: estimatedTokens,
      quotaWarning: forceQuotaWarning || estimatedTokens >= DAILY_TOKEN_QUOTA,
      quotaReference: DAILY_TOKEN_QUOTA
    };
  }

  // UC18: Update LLM API Key (Save to System_Settings table)
  static async updateAPIKey(newApiKey) {
    if (!newApiKey) throw new AppError(400, 'INVALID_KEY', 'API Key cannot be empty.');

    const { error } = await supabase
      .from('System_Settings')
      .upsert([{ setting_key: 'GEMINI_API_KEY', setting_value: newApiKey }], { onConflict: 'setting_key' });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to update Backup API Key.');
    forceQuotaWarning = false;
    return { success: true, message: 'Backup API Key updated successfully to ensure uninterrupted AI Workspace features.' };
  }

  static async restartDatabaseConnection() {
    // Supabase uses stateless HTTP requests rather than a persistent application-side pool.
    // A safe "restart" here means clearing the test/offline latch and actively retrying a fresh query.
    forceDatabaseFailure = false;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const startedAt = Date.now();
      try {
        const { error } = await supabase.from('User').select('userId').limit(1);
        if (!error) {
          return {
            success: true,
            databaseStatus: 'ONLINE',
            databaseLatencyMs: Date.now() - startedAt,
            message: 'Database connection re-established successfully.'
          };
        }
        lastError = error;
      } catch (error) {
        lastError = error;
      }
      await delay(300);
    }

    recordServerError(lastError || new Error('Connection Timeout'), 'Database Restart');
    throw new AppError(503, 'DB_CONNECTION_TIMEOUT', 'Connection Timeout');
  }

  static async getErrorLogs(limit = 50) {
    const boundedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const fileEntries = [];
    const logPath = process.env.SERVER_ERROR_LOG_PATH;

    if (logPath && fs.existsSync(logPath)) {
      try {
        const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean).slice(-boundedLimit).reverse();
        lines.forEach((line, index) => {
          fileEntries.push({
            id: `file-${index}-${line.length}`,
            timestamp: null,
            level: 'ERROR',
            context: 'Server Log File',
            code: 'SERVER_LOG',
            message: line,
            details: null
          });
        });
      } catch (error) {
        recordServerError(error, 'Error Log Reader');
      }
    }

    return [...recentErrorLogs, ...fileEntries].slice(0, boundedLimit);
  }

  static recordServerError(error, context) {
    return recordServerError(error, context);
  }

  static simulateDatabaseFailure() {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'TEST_MODE_DISABLED', 'Database failure simulation is disabled in production.');
    }
    forceDatabaseFailure = true;
    recordServerError(Object.assign(new Error('Connection Timeout'), { code: 'DB_CONNECTION_TIMEOUT' }), 'Controlled Database Failure');
    return { success: true, message: 'Controlled database connection failure enabled for testing.' };
  }

  static simulateQuotaExceeded() {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'TEST_MODE_DISABLED', 'Quota simulation is disabled in production.');
    }
    forceQuotaWarning = true;
    return { success: true, message: 'Controlled LLM API quota warning enabled for testing.' };
  }
}

module.exports = InfrastructureService;
