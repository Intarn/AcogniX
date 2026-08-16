const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');
const WorkspaceService = require('./WorkspaceService');

class AIHistoryService {
    // Mirrors NoteService._assertProjectOwnedBy
    static async _assertProjectOwnedBy(projectId, learnerId) {
        const { data: project, error: projectError } = await supabase
            .from('AI_Project')
            .select('projectId, workspaceId, status')
            .eq('projectId', projectId)
            .maybeSingle();

        if (projectError) throw projectError;
        if (!project) {
            throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        }
        if (project.status === 'INACTIVE') {
            throw new AppError(403, 'PROJECT_ACCESS_REVOKED', 'Access to this Class Project has been revoked.');
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

    static async deleteFlashcardSet(projectId, setId, learnerId) {
    // Xác thực quyền sở hữu Project
        await WorkspaceService.assertProjectWritable(projectId, learnerId);
        
        const { error } = await supabase
            .from('Flashcard_Set')
            .delete()
            .eq('flashcardSetId', setId)
            .eq('projectId', projectId);
            
        if (error) throw error;
        return true;
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
    

    // UC04: Persist the Learner's completed AI Practice Quiz result so the
    // Personal Statistics dashboard can use real practice-quiz history after
    // refresh. We reuse System_Settings as the project's existing generic
    // key/value persistence store, avoiding a database-schema migration.
    static async recordPracticeQuizAttempt(projectId, quizId, learnerId, payload = {}) {
        await this._assertProjectOwnedBy(projectId, learnerId);

        const { data: quiz, error: quizError } = await supabase
            .from('Practice_Quiz')
            .select('quizId, projectId, questionCount, difficultyLevel')
            .eq('quizId', quizId)
            .eq('projectId', projectId)
            .maybeSingle();

        if (quizError) throw quizError;
        if (!quiz) {
            throw new AppError(404, 'PRACTICE_QUIZ_NOT_FOUND', 'Practice Quiz not found.');
        }

        const score = Number(payload.score);
        const totalQuestions = Number(payload.totalQuestions || quiz.questionCount || 0);
        if (!Number.isFinite(score) || !Number.isFinite(totalQuestions) || totalQuestions <= 0 || score < 0 || score > totalQuestions) {
            throw new AppError(400, 'INVALID_PRACTICE_QUIZ_RESULT', 'Invalid Practice Quiz result.');
        }

        const { data: contextMaterials, error: materialError } = await supabase
            .from('Learning_Material')
            .select('title')
            .eq('projectId', projectId)
            .eq('selectedAsContext', true);

        if (materialError) throw materialError;

        const completedAt = payload.completedAt && !Number.isNaN(new Date(payload.completedAt).getTime())
            ? new Date(payload.completedAt).toISOString()
            : new Date().toISOString();

        const attempt = {
            learnerId,
            projectId,
            quizId,
            quizName: String(payload.quizName || 'AI Practice Quiz').trim() || 'AI Practice Quiz',
            difficultyLevel: quiz.difficultyLevel || null,
            score,
            totalQuestions,
            percentage: Math.round((score / totalQuestions) * 100),
            completedAt,
            sourceTitles: (contextMaterials || [])
                .map((item) => String(item.title || '').trim())
                .filter(Boolean)
        };

        const settingKey = `PRACTICE_QUIZ_ATTEMPT:${learnerId}:${quizId}`;
        const { error: saveError } = await supabase
            .from('System_Settings')
            .upsert([{
                setting_key: settingKey,
                setting_value: JSON.stringify(attempt)
            }], { onConflict: 'setting_key' });

        if (saveError) throw saveError;
        return attempt;
    }

    // Xóa Practice Quiz và xác thực quyền sở hữu Project
    static async deleteQuiz(projectId, quizId, learnerId) {
        await WorkspaceService.assertProjectWritable(projectId, learnerId);
        
        const { error } = await supabase
            .from('Practice_Quiz')
            .delete()
            .eq('quizId', quizId)
            .eq('projectId', projectId);
            
        if (error) throw error;
        return true;
    }
}

module.exports = AIHistoryService;