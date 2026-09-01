const AssessmentService = require('../service/AssessmentService');
const { UserRole } = require('../enums/AuthEnums');

function handleControllerError(error, res) {
    const statusCode = Number(error?.statusCode ?? error?.status);
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
        return res.status(statusCode).json({
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

class AssessmentController {
    // UC-09: Create Assessment 
    static async createAssessment(req, res) {
        try {
            const result = await AssessmentService.createAssessment(
                req.params.courseId, 
                req.user.userId, 
                req.body
            );

            return res.status(201).json({
                message: 'Assessment created successfully.', 
                assessment: result.assessment, 
                questions: result.questions
            }); 
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getManagedAssessments(req, res) {
        try {
            const assessments = await AssessmentService.getManagedAssessments(
                req.params.courseId, 
                req.user.userId
            );

            return res.status(200).json({ assessments }); 
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getAssessmentById(
        req,
        res
    ) {
        try {
            const assessment =
                await AssessmentService
                    .getAssessmentById(
                        req.params.assessmentId,
                        req.user.userId
                    );

            return res.status(200).json({
                assessment
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async getAssessmentQuestions(
        req,
        res
    ) {
        try {
            const questions =
                await AssessmentService
                    .getAssessmentQuestions(
                        req.params.assessmentId,
                        req.user.userId
                    );

            return res.status(200).json({
                assessmentId:
                    req.params.assessmentId,

                count:
                    questions.length,

                questions
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async getAssessmentSubmissions(
        req,
        res
    ) {
        try {
            const submissions =
                await AssessmentService
                    .getAssessmentSubmissions(
                        req.params.assessmentId,
                        req.user.userId
                    );

            return res.status(200).json({
                assessmentId:
                    req.params.assessmentId,

                count:
                    submissions.length,

                submissions
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async getSubmissionById(
        req,
        res
    ) {
        try {
            const result =
                await AssessmentService
                    .getSubmissionById(
                        req.params.submissionId,
                        req.user.userId
                    );

            return res.status(200).json(
                result
            );
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async getCourseGradebook(
        req,
        res
    ) {
        try {
            const result =
                await AssessmentService
                    .getCourseGradebook(
                        req.params.courseId,
                        req.user.userId
                    );

            return res.status(200).json(
                result
            );
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }


    static async getLearnerAssessments(
        req,
        res
    ) {
        try {
            const assessments =
                await AssessmentService
                    .getLearnerAssessments(
                        req.user.userId
                    );

            return res.status(200).json({
                count:
                    assessments.length,

                assessments
            });
        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }

    //UC-09: Edit Assessment.
    static async updateAssessment(req, res) {
        try {
            const assessment = await AssessmentService.updateAssessment(
                req.params.assessmentId, 
                req.user.userId, 
                req.body
            );
            return res.status(200).json({
                message: 'Assessment updated successfully.', 
                assessment
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    // UC-09: Delete Assessment
    static async deleteAssessment(req, res) {
        try {
            await AssessmentService.deleteAssessment(
                req.params.assessmentId, 
                req.user.userId
            );

            return res.status(200).json({
                message: 'Assessment deleted successfully.'
            });
        } catch (error) {
            return handleControllerError(error, res);
        }

    }

    static async addQuestion(req, res) {
        try {
            const question = await AssessmentService.addQuestion(
                req.params.assessmentId, 
                req.user.userId, 
                req.body
            );

            return res.status(201).json({
                message: 'Question added successfully.', 
                question
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async deleteQuestion(
        req,
        res
    ) {
        try {
            await AssessmentService
                .deleteQuestion(
                    req.params.assessmentId,
                    req.params.questionId,
                    req.user.userId
                );


            return res.status(200).json({
                message:
                    'Question deleted successfully.'
            });

        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }

    static async updateQuestion(req, res) {
    try {
        const question =
            await AssessmentService.updateQuestion(
                req.params.assessmentId,
                req.params.questionId,
                req.user.userId,
                req.body
            );

        return res.status(200).json({
            message: 'Question updated successfully.',
            question
        });

    } catch (error) {
        return handleControllerError(error, res);
    }
}

    static async scheduleAssessment(req, res) {
        try {
            const {startTime, deadline } = req.body; 

            const assessment = await AssessmentService.scheduleAssessment(
                req.params.assessmentId, 
                req.user.userId,
                startTime, 
                deadline
            );

            return res.status(200).json({
                message: 'Assessment schedule updated successfully.', 
                assessment
            }); 
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async publishAssessment(req, res) {
        try {
            const assessment = await AssessmentService.publishAssessment(
                req.params.assessmentId, 
                req.user.userId
            );

            return res.status(200).json({
                message: 'Assessment published successfully.', 
                assessment
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async uploadInstructionFile(req, res) {
        try {
            const assessment = await AssessmentService.uploadInstructionFile(
                req.params.assessmentId, 
                req.user.userId,
                req.file
            ); 

            return res.status(200).json({
                message: 'Assessment file uploaded successfully.', 
                assessmentId: assessment.assessmentId, 
                instructionFileUrl: assessment.instructionFileUrl
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getInstructionFile(req, res) {
        try {
            const result = req.user.role === UserRole.EDUCATOR
                ? await AssessmentService.getInstructionFileForEducator(
                    req.params.assessmentId,
                    req.user.userId
                )
                : await AssessmentService.getInstructionFileForLearner(
                    req.params.assessmentId,
                    req.user.userId
                );

            const disposition =
                req.query.download === '1'
                    ? 'attachment'
                    : 'inline';

            const originalFileName = String(
                result.fileName || 'assessment-instruction'
            ).replace(/[\r\n]/g, ' ').trim() || 'assessment-instruction';
            const safeFileName = originalFileName
                .replace(/[^\x20-\x7E]|["]/g, '_');
            const encodedFileName = encodeURIComponent(originalFileName);

            res.setHeader(
                'Content-Type',
                result.mimeType || 'application/octet-stream'
            );
            res.setHeader(
                'Content-Length',
                result.buffer.length
            );
            res.setHeader(
                'Content-Disposition',
                `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`
            );
            res.setHeader(
                'X-Content-Type-Options',
                'nosniff'
            );

            return res
                .status(200)
                .send(result.buffer);
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    // UC-10: Open the selected Assessment
    static async getOpenAssessment(req, res) {
        try {
            const result = await AssessmentService.getOpenAssessment(
                req.params.assessmentId, 
                req.user.userId
            );

            return res.status(200).json(result);
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async startSubmission(req, res) {
        try {
            const submission = await AssessmentService.startSubmission(
                req.params.assessmentId, 
                req.user.userId
            ); 

            return res.status(201).json({
                message: 'Assessment attempt started.', 
                submission
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async saveAnswer(req, res) {
        try {
            const answer = await AssessmentService.saveAnswer(
                req.params.submissionId, 
                req.user.userId, 
                req.params.questionId, 
                req.body.response
            ); 

            return res.status(200).json({
                message: 'Answer saved.',
                answer
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getSubmissionAnswers(
        req,
        res
    ) {
        try {
            const answers =
                await AssessmentService
                    .getSubmissionAnswers(
                        req.params.submissionId,
                        req.user.userId
                    );


            return res
                .status(200)
                .json({
                    count:
                        answers.length,

                    answers
                });

        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }

    static async uploadSubmissionFiles(req, res) {
        try {
            const files = await AssessmentService.uploadFiles(
                req.params.submissionId, 
                req.user.userId, 
                req.files
            ); 

            return res.status(201).json({
                message: 'Submission files uploaded successfully.',
                files: files.map(file => ({
                    fileName: file.fileName,
                    fileUrl: file.fileUrl,
                    sizeBytes: file.sizeBytes
                }))
            });
        } catch(error) {
            return handleControllerError(error, res);
        }
    }

    static async deleteSubmissionFile(
        req,
        res
    ) {
        try {
            const result =
                await AssessmentService
                    .deleteSubmissionFile(
                        req.params.submissionId,
                        req.user.userId,
                        req.body.fileUrl
                    );


            return res
                .status(200)
                .json({
                    message:
                        'Submission file deleted successfully.',

                    uploadedFileUrls:
                        result.uploadedFileUrls
                });

        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }

    static async submitSubmission(req, res) {
        try {
            const result = await AssessmentService.submitSubmission(
                req.params.submissionId, 
                req.user.userId
            );

            return res.status(200).json({
                message: result.submission.status === 'GRADED'
                ? 'Assessment submitted and graded successfully.'
                : 'Assessment submitted and is pending review.',
                submission: {
                    submissionId: result.submission.submissionId, 
                    status: result.submission.status, 
                    submittedAt: result.submission.submittedAt, 
                    late: result.submission.late, 
                    score: result.submission.score
                }
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async gradeSubmission(req, res) {
        try {
            const result = await AssessmentService.gradeSubmission(
                req.params.submissionId, 
                req.user.userId, 
                req.body.score, 
                req.body.feedback
            ); 

            return res.status(200).json({
                message: 'Submission graded successfully.', 
                submission: {
                    submissionId: result.submission.submissionId, 
                    status: result.submission.status, 
                    score: result.submission.score, 
                    feedback: result.submission.feedback
                }
            });
        } catch (error) {
            return handleControllerError(error, res);
        }
    }

    static async getLearnerAssessmentReview(
        req,
        res
    ) {
        try {
            const result =
                await AssessmentService
                    .getLearnerAssessmentReview(
                        req.params.assessmentId,
                        req.user.userId
                    );

            return res
                .status(200)
                .json(result);

        } catch (error) {
            return handleControllerError(
                error,
                res
            );
        }
    }
}

module.exports = AssessmentController;