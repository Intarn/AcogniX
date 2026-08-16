const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class AILearningService {
    static async _assertProjectAccess(projectId, learnerId) {
        const { data: project, error: projectError } = await supabase
            .from('AI_Project')
            .select('workspaceId, status')
            .eq('projectId', projectId)
            .maybeSingle();
            
        if (projectError) throw projectError;
        if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'The AI Project could not be found.');
        if (project.status === 'INACTIVE') {
            throw new AppError(403, 'PROJECT_ACCESS_REVOKED', 'Access to this Class Project has been revoked.');
        }

        const { data: workspace, error: workspaceError } = await supabase
            .from('AI_Workspace')
            .select('learnerId')
            .eq('workspaceId', project.workspaceId)
            .maybeSingle();
            
        if (workspaceError) throw workspaceError;
        if (!workspace || workspace.learnerId !== learnerId) {
            throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You do not have permission to access this project.');
        }
    }

    // UC-26: View Practice Quizzes
    static async getQuizzes(projectId, learnerId) {
        await this._assertProjectAccess(projectId, learnerId);
        
        const { data, error } = await supabase
            .from('Practice_Quiz')
            .select('*')
            .eq('projectId', projectId)
            .order('createdAt', { ascending: false });
            
        if (error) throw error;
        return data || [];
    }

    // UC-27: View Flashcard Sets
    static async getFlashcards(projectId, learnerId) {
        await this._assertProjectAccess(projectId, learnerId);
        
        const { data, error } = await supabase
            .from('Flashcard_Set')
            .select('*')
            .eq('projectId', projectId)
            .order('createdAt', { ascending: false });
            
        if (error) throw error;
        return data || [];
    }

    // UC-28: Retrieve AI Chat History
    static async getChatHistory(projectId, learnerId) {
        await this._assertProjectAccess(projectId, learnerId);

        const { data: conversation, error: convError } = await supabase
            .from('Conversation')
            .select('conversationId')
            .eq('projectId', projectId)
            .maybeSingle();

        if (convError) throw convError;
        if (!conversation) return []; 

        const { data: messages, error: msgError } = await supabase
            .from('Chat_Message')
            .select('messageId, senderRole, content, createdAt')
            .eq('conversationId', conversation.conversationId)
            .order('createdAt', { ascending: true }); 

        if (msgError) throw msgError;
        return messages || [];
    }
}

module.exports = AILearningService;