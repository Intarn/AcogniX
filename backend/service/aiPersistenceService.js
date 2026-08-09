const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class AIPersistenceService {
    // Confirms the given AI_Project belongs to the requesting learner
    // before any save, mirroring NoteService._assertProjectOwnedBy
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

    static async saveQuiz(projectId, learnerId, difficulty, questions) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        const { data, error } = await supabase
            .from('Quiz')
            .insert([{ projectId, difficulty, questions }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    static async saveFlashcards(projectId, learnerId, length, cards) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        const { data, error } = await supabase
            .from('Flashcard')
            .insert([{ projectId, length, cards }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    static async appendConversationMessages(projectId, learnerId, newMessages) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        const { data: existing, error: fetchError } = await supabase
            .from('Conversation')
            .select('*')
            .eq('projectId', projectId)
            .maybeSingle();
        if (fetchError) throw fetchError;

        if (existing) {
            const updatedMessages = [...(existing.messages || []), ...newMessages];
            const { data, error } = await supabase
                .from('Conversation')
                .update({ messages: updatedMessages, updatedAt: new Date().toISOString() })
                .eq('conversationId', existing.conversationId)
                .select()
                .single();
            if (error) throw error;
            return data;
        }

        const { data, error } = await supabase
            .from('Conversation')
            .insert([{ projectId, messages: newMessages }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}

module.exports = AIPersistenceService;