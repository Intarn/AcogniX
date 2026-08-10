const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class AIHistoryService {
    // Mirrors NoteService._assertProjectOwnedBy
    static async _assertProjectOwnedBy(projectId, learnerId) {
        const { data: project, error: projectError } = await supabase
            .from('AI_Project')
            .select('projectId, workspaceId')
            .eq('projectId', projectId)
            .maybeSingle();

        if (projectError) throw projectError;
        if (!project) {
            throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        }

        const { data: workspace, error: workspaceError } = await supabase
            .from('AI_Workspace')
            .select('workspaceId')
            .eq('workspaceId', project.workspaceId)
            .eq('learnerId', learnerId)
            .maybeSingle();

        if (workspaceError) throw workspaceError;
        if (!workspace) {
            throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You do not have access to this project.');
        }
    }

    static async getQuizzes(projectId, learnerId) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        const { data: quizzes, error } = await supabase
            .from('Practice_Quiz')
            .select('*, Practice_Question(*)')
            .eq('projectId', projectId)
            .order('generatedAt', { ascending: false });
        if (error) throw error;

        // optionsJson is stored as a JSON string (per the ERD) — parse it back to an array for the client
        return quizzes.map(quiz => ({
            ...quiz,
            Practice_Question: quiz.Practice_Question.map(q => ({
                ...q,
                options: JSON.parse(q.optionsJson)
            }))
        }));
    }

    static async getFlashcardSets(projectId, learnerId) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        const { data: sets, error } = await supabase
            .from('Flashcard_Set')
            .select('*, Flashcard(*)')
            .eq('projectId', projectId)
            .order('generatedAt', { ascending: false });
        if (error) throw error;

        // Ensure cards come back in the order they were generated
        return sets.map(set => ({
            ...set,
            Flashcard: set.Flashcard.sort((a, b) => a.position - b.position)
        }));
    }

    static async getConversations(projectId, learnerId, conversationId) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        if (conversationId) {
            // Return full message history for one specific conversation
            const { data: conversation, error: convError } = await supabase
                .from('Conversation')
                .select('*')
                .eq('conversationId', conversationId)
                .eq('projectId', projectId)
                .maybeSingle();
            if (convError) throw convError;
            if (!conversation) {
                throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
            }

            const { data: messages, error: msgError } = await supabase
                .from('Chat_Message')
                .select('*')
                .eq('conversationId', conversationId)
                .order('createdAt', { ascending: true });
            if (msgError) throw msgError;

            return { ...conversation, messages };
        }

        // No conversationId given: return the list of conversations for this project
        const { data: conversations, error } = await supabase
            .from('Conversation')
            .select('*')
            .eq('projectId', projectId)
            .order('createdAt', { ascending: false });
        if (error) throw error;

        return conversations;
    }
}

module.exports = AIHistoryService;