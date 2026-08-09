const supabase = require('../config/supabaseClient');

const PersonalNote = require('../entities/PersonalNote');

const AppError = require('../error/AppError');

class NoteService {
  // UC-25: Retrieve all Personal Notes in a Project
    static async getProjectNotes(projectId, learnerId) {
        await this._assertProjectOwnedBy(
            projectId,
            learnerId
        );

        const { data, error } = await supabase
            .from('PersonalNote')
            .select('*')
            .eq('projectId', projectId);

        if (error) throw error;

        return (data || []).map(
            note => new PersonalNote(note)
        );
    }


    // UC-25 Basic Flow: Save a new Personal Note
    static async createNote(projectId, learnerId, content, title = undefined) {
        await this._assertProjectOwnedBy(
            projectId,
            learnerId
        );

        const noteContent = String(content || '');

        // UC-25 Alternative Flow 1: Blank Submission
        if (!noteContent.trim()) {
            throw new AppError(
                400,
                'NOTE_CONTENT_REQUIRED',
                'Note content cannot be empty.'
            );
        }

        const noteData = {
            projectId,
            content: noteContent
        };

        // Database design currently contains a title field,
        // although UC-25 does not require it.
        if (title !== undefined) {
            noteData.title = String(title).trim() || null;
        }

        const { data, error } = await supabase
            .from('PersonalNote')
            .insert(noteData)
            .select()
            .single();

        if (error) throw error;

        return new PersonalNote(data);
    }


    // UC-25 Basic Flow: Save changes to an existing Note
    static async updateNote(noteId, learnerId, content, title = undefined) {
        await this._findOwnedNote(
            noteId,
            learnerId
        );

        const noteContent = String(content || '');

        if (!noteContent.trim()) {
            throw new AppError(
                400,
                'NOTE_CONTENT_REQUIRED',
                'Note content cannot be empty.'
            );
        }

        const updateData = {
            content: noteContent
        };

        if (title !== undefined) {
            updateData.title = String(title).trim() || null;
        }

        const { data, error } = await supabase
            .from('PersonalNote')
            .update(updateData)
            .eq('noteId', noteId)
            .select()
            .single();

        if (error) throw error;

        return new PersonalNote(data);
    }


    // UC-25 Basic Flow Step 5: Delete a Personal Note
    static async deleteNote(noteId,learnerId) {
        await this._findOwnedNote(
            noteId,
            learnerId
        );

        const { error } = await supabase
            .from('PersonalNote')
            .delete()
            .eq('noteId', noteId);

        if (error) throw error;
    }


    // Find a Note and verify that it belongs to the current Learner
    static async _findOwnedNote(noteId, learnerId) {
        const { data: note, error } = await supabase
            .from('PersonalNote')
            .select('*')
            .eq('noteId', noteId)
            .maybeSingle();

        if (error) throw error;


        if (!note) {
            throw new AppError(
                404,
                'NOTE_NOT_FOUND',
                'The Personal Note could not be found.'
            );
        }

        await this._assertProjectOwnedBy(
            note.projectId,
            learnerId
        );

        return note;
    }


    // Verify that the AI Project belongs to the current Learner
    static async _assertProjectOwnedBy(projectId, learnerId) {
        const { data: project, error: projectError } = await supabase
            .from('AI_Project')
            .select(
            'projectId, workspaceId, name, type, status'
            )
            .eq('projectId', projectId)
            .maybeSingle();

        if (projectError) {
            throw projectError;
        }

        if (!project) {
            throw new AppError(
                404,
                'PROJECT_NOT_FOUND',
                'The AI Project could not be found.'
            );
        }

        const { data: workspace, error: workspaceError} = await supabase
            .from('AI_Workspace')
            .select('workspaceId, learnerId')
            .eq('workspaceId', project.workspaceId)
            .maybeSingle();

        if (workspaceError) {
            throw workspaceError;
        }

        if (
            !workspace ||
            workspace.learnerId !== learnerId
        ) {
            throw new AppError(
                403,
                'PROJECT_ACCESS_DENIED',
                'You are not authorized to access this AI Project.'
            );
        }

        return project;
    }
}

module.exports = NoteService;