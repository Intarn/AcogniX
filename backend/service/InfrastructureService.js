const os = require('os');
const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class InfrastructureService {
  // UC-20: Monitor CPU, RAM, and Database status
  static async getSystemHealth() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.platform() === 'win32' ? [0, 0, 0] : os.loadavg();

    let dbStatus = 'ONLINE';
    try {
      // Test DB Connection
      const { error } = await supabase.from('User').select('userId').limit(1);
      if (error) throw error;
    } catch (err) {
      dbStatus = 'OFFLINE'; // Alt Flow 2: Database Connection Failure
    }

    return {
      os: os.type(),
      uptimeSeconds: os.uptime(),
      ram: {
        totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        usagePercentage: ((usedMem / totalMem) * 100).toFixed(1)
      },
      cpuLoad: cpuLoad[0].toFixed(2), // 1-minute load average
      databaseStatus: dbStatus
    };
  }

  // UC-20: Monitor AI Usage (Approximated by message & quiz counts)
  static async getLLMUsage() {
    // Get today's start date
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { count: chatCount, error: chatError } = await supabase
      .from('Chat_Message')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startOfToday.toISOString())
      .eq('senderRole', 'AI_TUTOR');

    const { count: quizCount, error: quizError } = await supabase
      .from('Practice_Quiz')
      .select('*', { count: 'exact', head: true })
      .gte('generatedAt', startOfToday.toISOString());

    if (chatError || quizError) throw new AppError(500, 'DB_ERROR', 'Failed to retrieve LLM usage statistics.');

    const estimatedTokens = (chatCount * 150) + (quizCount * 800); // Rough estimation logic
    const isQuotaExceeded = estimatedTokens > 100000; // E.g., Daily Limit is 100k tokens

    return {
      apiRequestsToday: (chatCount || 0) + (quizCount || 0),
      estimatedTokensConsumed: estimatedTokens,
      quotaWarning: isQuotaExceeded // Alt Flow 1: LLM API Quota exceeded
    };
  }

  // UC-20: Update LLM API Key (Save to System_Settings table)
  static async updateAPIKey(newApiKey) {
    if (!newApiKey) throw new AppError(400, 'INVALID_KEY', 'API Key cannot be empty.');

    const { error } = await supabase
      .from('System_Settings')
      .upsert([{ setting_key: 'GEMINI_API_KEY', setting_value: newApiKey }], { onConflict: 'setting_key' });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to update Backup API Key.');
    return { success: true, message: 'Backup API Key updated successfully to ensure uninterrupted AI Workspace features.' };
  }
}

module.exports = InfrastructureService;