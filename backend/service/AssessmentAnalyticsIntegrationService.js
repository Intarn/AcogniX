const supabase = require('../config/supabaseClient');

class AssessmentAnalyticsIntegrationService {
  static async recordAssessmentScore({ learnerId, courseId, assessmentId, score }) {
    try {
        const { data, error } = await supabase
            .from('Assessment_Result_Log')
            .insert([{ 
                learnerId, 
                courseId, 
                assessmentId, 
                score: Number(score) 
            }])
            .select()
            .single();

        if (error) throw error;

        return {
          recorded: true,
          data
        };
    } catch (error) {
        console.error('[Analytics] Failed to record assessment score:', error);
        return {
          recorded: false,
          reason: 'DATABASE_ERROR'
        };
    }
  }
}

module.exports = AssessmentAnalyticsIntegrationService;