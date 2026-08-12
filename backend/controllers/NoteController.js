const NoteService = require('../service/NoteService');


function handleControllerError(error, res) {
    if (error.statusCode) {
        return res
        .status(error.statusCode)
        .json({
            code: error.code,
            message: error.message
        });
    }

    console.error(error);

    return res.status(500).json({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.'
    });
}


class NoteController {

    static async getProjectNotes(req, res) {
        try {
        const notes =
            await NoteService.getProjectNotes(
                req.params.projectId,
                req.user.userId
            );

            return res.status(200).json({
                projectId: req.params.projectId,
                count: notes.length,
                notes
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }

    static async getAllNotes(
        req,
        res
    ) {
        try {
            const notes =
                await NoteService
                    .getAllNotes(
                        req.user.userId
                    );


            return res
                .status(200)
                .json({
                    count:
                        notes.length,

                    notes
                });

        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async createNote(req, res) {
        try {
            const {
                content,
                title
            } = req.body;

            const note =
                await NoteService.createNote(
                req.params.projectId,
                req.user.userId,
                content,
                title
                );

            return res.status(201).json({
                message:
                'Personal Note saved successfully.',
                note
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async updateNote(req, res) {
        try {
            const {
                content,
                title
            } = req.body;

            const note =
                await NoteService.updateNote(
                req.params.noteId,
                req.user.userId,
                content,
                title
                );

            return res.status(200).json({
                message:
                'Personal Note updated successfully.',
                note
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async deleteNote(req, res) {
        try {
            await NoteService.deleteNote(
                req.params.noteId,
                req.user.userId
            );

            return res.status(200).json({
                message:
                'Personal Note deleted successfully.'
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }
}

module.exports = NoteController;