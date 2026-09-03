// backend/service/AssessmentService.js
const supabase = require('../config/supabaseClient');
const Assessment = require('../entities/Assessment');
const Question = require('../entities/Question');
const Submission = require('../entities/Submission');
const SubmissionAnswer = require('../entities/SubmissionAnswer');
const AppError = require('../error/AppError');
const NotificationService = require('./NotificationService');
const AssessmentAnalyticsIntegrationService = require('./AssessmentAnalyticsIntegrationService');
const { EnrollmentStatus } = require('../enums/ClassroomEnums');
const {
    AssessmentType,
    AssessmentStatus,
    QuestionType,
    SubmissionStatus
} = require('../enums/AssessmentEnums');
const path = require('path');
const crypto = require('crypto');

class AssessmentService {
    static async createAssessment(courseId, educatorId, assessmentInput) {
        await this._assertCourseManagedBy(courseId, educatorId);

        const {
            title,
            description = null,
            type,
            totalPoints,
            allowLateSubmission = false,
            startTime = null,
            deadline = null,
            questions = []
        } = assessmentInput;

        if (!title || !Object.values(AssessmentType).includes(type)) {
            throw new AppError(
                400,
                'INVALID_ASSESSMENT_DATA',
                'Assessment title and type are required.'
            );
        }

        const numericTotalPoints = this._validateTotalPoints(totalPoints);
        // Drafts may be incomplete. Question points are validated only when publishing.

        if ((startTime && !deadline) || (!startTime && deadline)) {
            throw new AppError(
                400,
                'INCOMPLETE_ASSESSMENT_SCHEDULE',
                'Both start time and deadline are required.'
            );
        }

        if (startTime && deadline) {
            this._validateSchedule(startTime, deadline);
        }

        const initialStatus = startTime && deadline
            ? AssessmentStatus.SCHEDULED
            : AssessmentStatus.DRAFT;

        const { data, error } = await supabase
            .from('Assessment')
            .insert({
                courseId,
                title,
                description,
                type,
                startTime,
                deadline,
                totalPoints: numericTotalPoints,
                allowLateSubmission: Boolean(allowLateSubmission),
                status: initialStatus
            })
            .select()
            .single();

        if (error) throw error;

        const expectedQuestionType = this._getExpectedQuestionType(type);
        const savedQuestions = [];
        for (const questionInput of questions) {
            this._assertQuestionTypeMatchesAssessment(questionInput?.type, expectedQuestionType, type);
            const question = await this._insertQuestion(
                data.assessmentId,
                questionInput
            );
            savedQuestions.push(question);
        }

        await this._notifyCourseLearners({
            courseId,
            assessmentId: data.assessmentId,
            action: 'CREATED'
        });

        return {
            assessment: this._toAssessment(data),
            questions: savedQuestions
        };
    }

    static async getManagedAssessments(courseId, educatorId) {
        await this._assertCourseManagedBy(courseId, educatorId);

        const { data, error } = await supabase
            .from('Assessment')
            .select('*')
            .eq('courseId', courseId)
            .order('startTime', { ascending: false });

        if (error) throw error;

        const assessments = [];
        for (const row of data || []) {
            const synchronized = await this._synchronizeAssessmentStatus(row);
            assessments.push(this._toAssessment(synchronized));
        }
        return assessments;
    }

    static async getAssessmentById(assessmentId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        return this._toAssessment(synchronized);
    }

    static async getAssessmentQuestions(assessmentId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        return this._loadQuestionsWithOptions(assessmentId, true);
    }

    static async getAssessmentSubmissions(assessmentId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);

        // Late-disabled assessments must not leave expired drafts visible to the Educator.
        if (synchronized.status === AssessmentStatus.CLOSED && !synchronized.allowLateSubmission) {
            await this._discardExpiredDraftsForAssessment(assessmentId);
        }

        const finalizedStatuses = [
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.PENDING_REVIEW,
            SubmissionStatus.GRADED
        ];

        const { data, error } = await supabase
            .from('Submission')
            .select('*')
            .eq('assessmentId', assessmentId)
            .in('status', finalizedStatuses)
            .order('submittedAt', { ascending: false });

        if (error) throw error;
        return (data || []).map(row => this._toSubmission(row));
    }

    static async getSubmissionById(submissionId, educatorId) {
        const { data: submissionRow, error: submissionError } = await supabase
            .from('Submission')
            .select('*')
            .eq('submissionId', submissionId)
            .maybeSingle();

        if (submissionError) throw submissionError;
        if (!submissionRow) {
            throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'The Submission could not be found.');
        }

        const assessmentRow = await this._findAssessmentById(submissionRow.assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);

        if (
            submissionRow.status === SubmissionStatus.IN_PROGRESS &&
            synchronized.status === AssessmentStatus.CLOSED &&
            !synchronized.allowLateSubmission
        ) {
            await this._discardSubmission(submissionRow);
            throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'The Submission could not be found.');
        }

        if (submissionRow.status === SubmissionStatus.IN_PROGRESS) {
            throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'The Submission could not be found.');
        }

        const { data: answerRows, error: answerError } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq('submissionId', submissionId);

        if (answerError) throw answerError;

        const { data: learner, error: learnerError } = await supabase
            .from('User')
            .select('userId, email, displayName, avatarUrl')
            .eq('userId', submissionRow.learnerId)
            .maybeSingle();

        if (learnerError) throw learnerError;

        const submission = this._toSubmission(submissionRow);

        return {
            submission,
            learner: learner || null,
            answers: (answerRows || []).map(row => new SubmissionAnswer(row)),
            files: Array.isArray(submission.uploadedFileUrls)
                ? await Promise.all(
                    submission.uploadedFileUrls.map(
                        filePath => this._getSubmissionFileAccessUrl(filePath)
                    )
                )
                : []
        };
    }

    static async updateAssessment(assessmentId, educatorId, changes) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'An active or closed Assessment cannot be edited.'
            );
        }

        const updateData = {};

        if (changes.title !== undefined) {
            if (!String(changes.title).trim()) {
                throw new AppError(
                    400,
                    'ASSESSMENT_TITLE_REQUIRED',
                    'Assessment title cannot be empty.'
                );
            }
            updateData.title = String(changes.title).trim();
        }
        if (changes.description !== undefined) {
            updateData.description = changes.description || null;
        }
        if (changes.type !== undefined) {
            if (!Object.values(AssessmentType).includes(changes.type)) {
                throw new AppError(
                    400,
                    'INVALID_ASSESSMENT_TYPE',
                    'The supplied Assessment type is invalid.'
                );
            }

            if (changes.type !== assessmentRow.type) {
                const { data: existingQuestions, error: questionLookupError } = await supabase
                    .from('Question')
                    .select('questionId')
                    .eq('assessmentId', assessmentId)
                    .limit(1);

                if (questionLookupError) throw questionLookupError;
                if ((existingQuestions || []).length > 0) {
                    throw new AppError(
                        409,
                        'ASSESSMENT_TYPE_CHANGE_REQUIRES_EMPTY_QUESTION_LIST',
                        'Delete all Questions before changing the Assessment type.'
                    );
                }
            }

            updateData.type = changes.type;
        }
        if (changes.totalPoints !== undefined) {
            updateData.totalPoints = this._validateTotalPoints(changes.totalPoints);
        }
        if (changes.allowLateSubmission !== undefined) {
            updateData.allowLateSubmission = Boolean(changes.allowLateSubmission);
        }

        // Persist schedule values on a Draft WITHOUT promoting it to SCHEDULED.
        // Promotion is intentionally handled only by scheduleAssessment()/publishAssessment().
        if (changes.startTime !== undefined || changes.deadline !== undefined) {
            const nextStartTime = changes.startTime !== undefined
                ? changes.startTime
                : assessmentRow.startTime;
            const nextDeadline = changes.deadline !== undefined
                ? changes.deadline
                : assessmentRow.deadline;

            if ((nextStartTime && !nextDeadline) || (!nextStartTime && nextDeadline)) {
                throw new AppError(
                    400,
                    'INCOMPLETE_ASSESSMENT_SCHEDULE',
                    'Both start time and deadline are required.'
                );
            }

            if (nextStartTime && nextDeadline) {
                this._validateSchedule(nextStartTime, nextDeadline);
                updateData.startTime = new Date(nextStartTime).toISOString();
                updateData.deadline = new Date(nextDeadline).toISOString();
            } else {
                updateData.startTime = null;
                updateData.deadline = null;
            }

            // A Draft stays a Draft even when it already has a complete schedule.
            if (assessmentRow.status === AssessmentStatus.DRAFT) {
                updateData.status = AssessmentStatus.DRAFT;
            }
        }

        // Draft edits may temporarily have question points that do not match Total Points.
        // The invariant is enforced by publishAssessment().

        const { data, error } = await supabase
            .from('Assessment')
            .update(updateData)
            .eq('assessmentId', assessmentId)
            .select()
            .single();

        if (error) throw error;

        await this._notifyCourseLearners({
            courseId: data.courseId,
            assessmentId,
            action: 'UPDATED'
        });

        return this._toAssessment(data);
    }

    static async deleteAssessment(assessmentId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        const deletableStatuses = [
            AssessmentStatus.DRAFT,
            AssessmentStatus.SCHEDULED
        ];

        if (!deletableStatuses.includes(assessment.status)) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_DELETABLE',
                'Only Draft or Scheduled Assessments can be deleted.'
            );
        }

        const { error } = await supabase
            .from('Assessment')
            .delete()
            .eq('assessmentId', assessmentId);

        if (error) throw error;

        await this._notifyCourseLearners({
            courseId: assessmentRow.courseId,
            assessmentId,
            action: 'DELETED'
        });
    }

    static async addQuestion(assessmentId, educatorId, questionInput) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'Questions cannot be changed after the Assessment becomes active.'
            );
        }

        const expectedQuestionType = this._getExpectedQuestionType(assessmentRow.type);
        this._assertQuestionTypeMatchesAssessment(
            questionInput?.type,
            expectedQuestionType,
            assessmentRow.type
        );

        return this._insertQuestion(assessmentId, questionInput);
    }

    static async updateQuestion(assessmentId, questionId, educatorId, changes) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'An active or closed Assessment cannot be edited.'
            );
        }

        const { data: questionRow, error: questionError } = await supabase
            .from('Question')
            .select('*')
            .eq('questionId', questionId)
            .eq('assessmentId', assessmentId)
            .maybeSingle();

        if (questionError) throw questionError;
        if (!questionRow) {
            throw new AppError(
                404,
                'QUESTION_NOT_FOUND',
                'The Question could not be found in this Assessment.'
            );
        }

        const updateData = {};

        if (changes.content !== undefined) {
            const content = String(changes.content).trim();
            if (!content) {
                throw new AppError(400, 'QUESTION_CONTENT_REQUIRED', 'Question content cannot be empty.');
            }
            updateData.content = content;
        }

        if (changes.points !== undefined) {
            const points = Number(changes.points);
            if (!Number.isFinite(points) || points <= 0) {
                throw new AppError(400, 'INVALID_QUESTION_POINTS', 'Question points must be greater than 0.');
            }
            updateData.points = points;
        }

        if (changes.displayOrder !== undefined) {
            const displayOrder = Number(changes.displayOrder);
            if (!Number.isInteger(displayOrder) || displayOrder < 0) {
                throw new AppError(400, 'INVALID_DISPLAY_ORDER', 'Question display order must be a non-negative integer.');
            }
            updateData.displayOrder = displayOrder;
        }

        const finalType = changes.type !== undefined ? changes.type : questionRow.type;
        if (!Object.values(QuestionType).includes(finalType)) {
            throw new AppError(400, 'INVALID_QUESTION_DATA', 'The supplied Question type is invalid.');
        }

        const expectedQuestionType = this._getExpectedQuestionType(assessmentRow.type);
        this._assertQuestionTypeMatchesAssessment(
            finalType,
            expectedQuestionType,
            assessmentRow.type
        );
        if (changes.type !== undefined) {
            updateData.type = finalType;
        }

        if (finalType === QuestionType.MULTIPLE_CHOICE) {
            if (changes.options !== undefined) {
                if (!Array.isArray(changes.options)) {
                    throw new AppError(400, 'INVALID_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice options must be an array.');
                }
                const correctOptions = changes.options.filter(option => option.isCorrect === true);
                if (changes.options.length < 2 || correctOptions.length !== 1) {
                    throw new AppError(
                        400,
                        'INVALID_MULTIPLE_CHOICE_OPTIONS',
                        'A multiple-choice Question requires at least two options and exactly one correct option.'
                    );
                }
                const optionContents = changes.options.map(option => String(option.content || '').trim());
                if (optionContents.some(content => !content)) {
                    throw new AppError(400, 'INVALID_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice option content cannot be empty.');
                }
                if (new Set(optionContents.map(content => content.toLowerCase())).size !== optionContents.length) {
                    throw new AppError(400, 'DUPLICATE_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice options must be unique.');
                }
                updateData.options = optionContents;
                updateData.correctAnswer = String(correctOptions[0].content).trim();
            } else if (questionRow.type !== QuestionType.MULTIPLE_CHOICE) {
                throw new AppError(400, 'INVALID_MULTIPLE_CHOICE_OPTIONS', 'Options are required when changing a Question to multiple choice.');
            }
        }

        if (finalType === QuestionType.ESSAY && questionRow.type !== QuestionType.ESSAY) {
            updateData.options = [];
            updateData.correctAnswer = null;
        }

        if (Object.keys(updateData).length === 0) {
            throw new AppError(400, 'NO_QUESTION_CHANGES', 'No Question changes were supplied.');
        }

        const { data, error } = await supabase
            .from('Question')
            .update(updateData)
            .eq('questionId', questionId)
            .eq('assessmentId', assessmentId)
            .select()
            .single();

        if (error) throw error;

        await this._notifyCourseLearners({
            courseId: assessmentRow.courseId,
            assessmentId,
            action: 'UPDATED'
        });

        return new Question(data);
    }

    static async deleteQuestion(assessmentId, questionId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'Questions cannot be changed after the Assessment becomes active.'
            );
        }

        const { data: questionRow, error: questionError } = await supabase
            .from('Question')
            .select('questionId, assessmentId')
            .eq('questionId', questionId)
            .eq('assessmentId', assessmentId)
            .maybeSingle();

        if (questionError) throw questionError;
        if (!questionRow) {
            throw new AppError(404, 'QUESTION_NOT_FOUND', 'The Question could not be found in this Assessment.');
        }

        const { error: deleteError } = await supabase
            .from('Question')
            .delete()
            .eq('questionId', questionId)
            .eq('assessmentId', assessmentId);

        if (deleteError) throw deleteError;

        await this._notifyCourseLearners({
            courseId: assessmentRow.courseId,
            assessmentId,
            action: 'UPDATED'
        });
    }

    static async scheduleAssessment(assessmentId, educatorId, startTime, deadline) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'An active or closed Assessment cannot be rescheduled.'
            );
        }

        this._validateSchedule(startTime, deadline);

        const { data, error } = await supabase
            .from('Assessment')
            .update({
                startTime: new Date(startTime).toISOString(),
                deadline: new Date(deadline).toISOString(),
                status: AssessmentStatus.SCHEDULED
            })
            .eq('assessmentId', assessmentId)
            .select()
            .single();

        if (error) throw error;

        await this._notifyCourseLearners({
            courseId: data.courseId,
            assessmentId,
            action: 'SCHEDULED'
        });

        return this._toAssessment(data);
    }

    static async getCourseGradebook(courseId, educatorId) {
        await this._assertCourseManagedBy(courseId, educatorId);

        const { data: course, error: courseError } = await supabase
            .from('Course')
            .select('courseId, educatorId, subjectName, courseCode, description, status')
            .eq('courseId', courseId)
            .maybeSingle();

        if (courseError) throw courseError;

        const assessments = await this.getManagedAssessments(courseId, educatorId);

        const { data: enrollments, error: enrollmentError } = await supabase
            .from('Enrollment')
            .select('learnerId')
            .eq('courseId', courseId)
            .eq('status', EnrollmentStatus.APPROVED);

        if (enrollmentError) throw enrollmentError;

        const learnerIds = [...new Set((enrollments || []).map(item => item.learnerId))];
        let learners = [];
        if (learnerIds.length > 0) {
            const { data, error } = await supabase
                .from('User')
                .select('userId, email, displayName, avatarUrl')
                .in('userId', learnerIds);
            if (error) throw error;
            learners = data || [];
        }

        const assessmentIds = assessments.map(assessment => assessment.assessmentId);
        let submissions = [];
        if (assessmentIds.length > 0) {
            const { data, error } = await supabase
                .from('Submission')
                .select('*')
                .in('assessmentId', assessmentIds);
            if (error) throw error;
            submissions = (data || []).map(row => this._toSubmission(row));
        }

        return {
            course,
            assessments,
            learners,
            submissions
        };
    }

    static async publishAssessment(assessmentId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);

        if (!assessmentRow.startTime || !assessmentRow.deadline) {
            throw new AppError(
                400,
                'ASSESSMENT_SCHEDULE_REQUIRED',
                'Configure the Assessment schedule before publishing it.'
            );
        }

        await this._assertStoredQuestionsReadyForPublish(
            assessmentId,
            assessmentRow.totalPoints,
            assessmentRow.type
        );

        const now = new Date();
        const startTime = new Date(assessmentRow.startTime);
        const deadline = new Date(assessmentRow.deadline);

        let status = AssessmentStatus.SCHEDULED;
        if (now >= startTime && now <= deadline) {
            status = AssessmentStatus.IN_PROGRESS;
        } else if (now > deadline) {
            status = AssessmentStatus.CLOSED;
        }

        const { data, error } = await supabase
            .from('Assessment')
            .update({ status })
            .eq('assessmentId', assessmentId)
            .select()
            .single();

        if (error) throw error;

        await this._notifyCourseLearners({
            courseId: data.courseId,
            assessmentId,
            action: 'PUBLISHED'
        });

        return this._toAssessment(data);
    }

    static async uploadInstructionFile(assessmentId, educatorId, file) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        const assessment = this._toAssessment(
            await this._synchronizeAssessmentStatus(assessmentRow)
        );

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'The instruction file cannot be changed after the Assessment becomes active.'
            );
        }

        if (!file) {
            throw new AppError(
                400,
                'ASSESSMENT_FILE_REQUIRED',
                'Please select an Assessment file.'
            );
        }

        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        const safeFileName = this._generateSafeFileName(file.originalname);
        const filePath = `instructions/${assessmentId}/${safeFileName}`;

        const { data: uploadedFile, error: storageError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (storageError) {
            console.error('[Storage Upload Error]:', storageError);
            throw new AppError(500, 'STORAGE_UPLOAD_ERROR', 'Failed to upload assessment instruction file.');
        }

        const storedFilePath = uploadedFile?.path || filePath;
        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storedFilePath);

        const publicUrl = publicUrlData?.publicUrl || storedFilePath;

        const { data, error } = await supabase
            .from('Assessment')
            .update({ instructionFileUrl: publicUrl })
            .eq('assessmentId', assessmentId)
            .select()
            .single();

        if (error) throw error;

        await this._notifyCourseLearners({
            courseId: data.courseId,
            assessmentId,
            action: 'UPDATED'
        });

        return this._toAssessment(data);
    }

    static async getInstructionFileForEducator(assessmentId, educatorId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);
        return this._downloadInstructionFile(assessmentRow);
    }

    static async getInstructionFileForLearner(assessmentId, learnerId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertLearnerEnrolled(assessmentRow.courseId, learnerId);
        return this._downloadInstructionFile(assessmentRow);
    }

    static async _downloadInstructionFile(assessmentRow) {
        const rawUrl = String(assessmentRow?.instructionFileUrl || '').trim();
        if (!rawUrl) {
            throw new AppError(
                404,
                'INSTRUCTION_FILE_NOT_FOUND',
                'Assessment instruction file is not available.'
            );
        }

        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        let filePath = '';

        try {
            if (/^https?:\/\//i.test(rawUrl)) {
                const parsedUrl = new URL(rawUrl);
                const decodedPath = decodeURIComponent(parsedUrl.pathname);
                const markers = [
                    `/storage/v1/object/public/${bucket}/`,
                    `/storage/v1/object/sign/${bucket}/`,
                    `/storage/v1/object/${bucket}/`,
                    `/${bucket}/`
                ];
                const matchedMarker = markers.find((value) => decodedPath.includes(value));

                if (matchedMarker) {
                    filePath = decodedPath.slice(
                        decodedPath.indexOf(matchedMarker) + matchedMarker.length
                    );
                }
            } else {
                filePath = decodeURIComponent(rawUrl.split('?')[0]);
                if (filePath.startsWith(`${bucket}/`)) {
                    filePath = filePath.slice(bucket.length + 1);
                }
            }
        } catch (_) {
            filePath = '';
        }

        filePath = String(filePath || '').replace(/^\/+/, '').trim();
        if (!filePath) {
            throw new AppError(
                410,
                'INSTRUCTION_FILE_UNAVAILABLE',
                'Assessment instruction file is no longer available.'
            );
        }

        const { data: downloaded, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(filePath);

        if (downloadError || !downloaded) {
            throw new AppError(
                410,
                'INSTRUCTION_FILE_UNAVAILABLE',
                'Assessment instruction file is no longer available.'
            );
        }

        let buffer;
        if (Buffer.isBuffer(downloaded)) {
            buffer = downloaded;
        } else if (typeof downloaded.arrayBuffer === 'function') {
            buffer = Buffer.from(await downloaded.arrayBuffer());
        } else {
            buffer = Buffer.from(downloaded);
        }

        if (!buffer || buffer.length === 0) {
            throw new AppError(
                410,
                'INSTRUCTION_FILE_UNAVAILABLE',
                'Assessment instruction file is empty or unavailable.'
            );
        }

        const fileName =
            this._getInstructionFileName(rawUrl) ||
            'Assessment instruction file';
        const lowerName = String(fileName).toLowerCase();
        const mimeType = lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : lowerName.endsWith('.docx')
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/octet-stream';

        return {
            buffer,
            fileName,
            mimeType
        };
    }

    static async getOpenAssessment(assessmentId, learnerId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertLearnerEnrolled(assessmentRow.courseId, learnerId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.canAcceptSubmission()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_OPEN',
                'This Assessment is not currently available for submission.'
            );
        }

        const questions = await this._loadQuestionsWithOptions(assessmentId, false);
        return {
            assessment,
            questions
        };
    }

    static async startSubmission(assessmentId, learnerId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertLearnerEnrolled(assessmentRow.courseId, learnerId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.canAcceptSubmission()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_OPEN',
                'This Assessment is not currently available for submission.'
            );
        }

        const { data: existing, error: existingError } = await supabase
            .from('Submission')
            .select('*')
            .eq('assessmentId', assessmentId)
            .eq('learnerId', learnerId)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
            if (existing.status === SubmissionStatus.IN_PROGRESS) {
                return this._toSubmission(existing);
            }

            const editableSubmittedAssignment =
                assessment.type === AssessmentType.ASSIGNMENT &&
                assessment.isOpen() &&
                [SubmissionStatus.SUBMITTED, SubmissionStatus.PENDING_REVIEW].includes(existing.status);

            if (editableSubmittedAssignment) {
                return this._toSubmission(existing);
            }

            throw new AppError(
                409,
                'ASSESSMENT_ALREADY_SUBMITTED',
                'You have already submitted this Assessment.'
            );
        }

        const { data, error } = await supabase
            .from('Submission')
            .insert({
                assessmentId,
                learnerId,
                status: SubmissionStatus.IN_PROGRESS,
                startedAt: new Date().toISOString(),
                submittedAt: null,
                late: false,
                score: null,
                feedback: null
            })
            .select()
            .single();

        if (error) throw error;
        return this._toSubmission(data);
    }

    static async saveAnswer(submissionId, learnerId, questionId, response) {
        const submission = await this._assertOwnedSubmission(submissionId, learnerId);
        const assessmentRow = await this._findAssessmentById(submission.assessmentId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (
            submission.status === SubmissionStatus.IN_PROGRESS &&
            assessment.status === AssessmentStatus.CLOSED &&
            !assessment.allowLateSubmission
        ) {
            await this._discardSubmission(submission);
            throw new AppError(
                409,
                'LATE_SUBMISSION_NOT_ALLOWED',
                'The deadline has passed. This unfinished attempt was discarded because late submission is not allowed.'
            );
        }

        const canAcceptSubmission = assessment.canAcceptSubmission();
        const editableQuiz =
            assessment.type === AssessmentType.QUIZ &&
            canAcceptSubmission &&
            submission.status === SubmissionStatus.IN_PROGRESS;

        const editableAssignment =
            assessment.type === AssessmentType.ASSIGNMENT &&
            ((submission.status === SubmissionStatus.IN_PROGRESS && canAcceptSubmission) ||
             (assessment.isOpen() && [SubmissionStatus.SUBMITTED, SubmissionStatus.PENDING_REVIEW].includes(submission.status)));

        if (!editableQuiz && !editableAssignment) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_EDITABLE',
                'This Submission can no longer be changed.'
            );
        }

        const { data: question, error: questionError } = await supabase
            .from('Question')
            .select('questionId, assessmentId')
            .eq('questionId', questionId)
            .eq('assessmentId', submission.assessmentId)
            .maybeSingle();

        if (questionError) throw questionError;
        if (!question) {
            throw new AppError(404, 'QUESTION_NOT_FOUND', 'The Question does not belong to this Assessment.');
        }

        const { data: existing, error: existingError } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq('submissionId', submissionId)
            .eq('questionId', questionId)
            .maybeSingle();

        if (existingError) throw existingError;

        let savedAnswer;
        if (existing) {
            const { data, error } = await supabase
                .from('SubmissionAnswer')
                .update({ response: String(response ?? '') })
                .eq('answerId', existing.answerId)
                .select()
                .single();
            if (error) throw error;
            savedAnswer = data;
        } else {
            const { data, error } = await supabase
                .from('SubmissionAnswer')
                .insert({
                    submissionId,
                    questionId,
                    response: String(response ?? '')
                })
                .select()
                .single();
            if (error) throw error;
            savedAnswer = data;
        }

        return new SubmissionAnswer(savedAnswer);
    }

    static async getSubmissionAnswers(submissionId, learnerId) {
        const submission = await this._assertOwnedSubmission(submissionId, learnerId);

        const { data: answerRows, error: answerError } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq('submissionId', submission.submissionId);

        if (answerError) throw answerError;

        return (answerRows || []).map(row => new SubmissionAnswer(row));
    }

    static async uploadFiles(submissionId, learnerId, files) {
        const submission = await this._assertOwnedSubmission(submissionId, learnerId);
        const assessmentRow = await this._findAssessmentById(submission.assessmentId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (
            submission.status === SubmissionStatus.IN_PROGRESS &&
            assessment.status === AssessmentStatus.CLOSED &&
            !assessment.allowLateSubmission
        ) {
            await this._discardSubmission(submission);
            throw new AppError(
                409,
                'LATE_SUBMISSION_NOT_ALLOWED',
                'The deadline has passed. This unfinished attempt was discarded because late submission is not allowed.'
            );
        }

        const canAcceptSubmission = assessment.canAcceptSubmission();
        const editableAssignment =
            assessment.type === AssessmentType.ASSIGNMENT &&
            ((submission.status === SubmissionStatus.IN_PROGRESS && canAcceptSubmission) ||
             (assessment.isOpen() && [SubmissionStatus.SUBMITTED, SubmissionStatus.PENDING_REVIEW].includes(submission.status)));

        const editableQuiz =
            assessment.type === AssessmentType.QUIZ &&
            canAcceptSubmission &&
            submission.status === SubmissionStatus.IN_PROGRESS;

        if (!editableAssignment && !editableQuiz) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_EDITABLE',
                'This Submission can no longer be changed.'
            );
        }

        if (!files || files.length === 0) {
            throw new AppError(400, 'SUBMISSION_FILES_REQUIRED', 'Please select at least one file.');
        }

        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        const existingFileUrls = Array.isArray(submission.uploadedFileUrls) ? submission.uploadedFileUrls : [];
        const uploadedFiles = [];

        for (const file of files) {
            const originalFileName = String(file.originalname || 'file')
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                .replace(/\s+/g, ' ')
                .trim();
            const storedFileName = `${crypto.randomUUID()}__${originalFileName}`;
            const filePath = `submissions/${submissionId}/${storedFileName}`;

            const { error: storageError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (storageError) throw storageError;

            uploadedFiles.push({
                fileName: originalFileName,
                fileUrl: filePath,
                sizeBytes: file.size
            });
        }

        const uploadedFileUrls = [
            ...existingFileUrls,
            ...uploadedFiles.map(file => file.fileUrl)
        ];

        const { error: updateError } = await supabase
            .from('Submission')
            .update({ uploadedFileUrls })
            .eq('submissionId', submissionId);

        if (updateError) throw updateError;
        return uploadedFiles;
    }

    static async deleteSubmissionFile(submissionId, learnerId, fileUrl) {
        const submission = await this._assertOwnedSubmission(submissionId, learnerId);
        if (!fileUrl || !String(fileUrl).trim()) {
            throw new AppError(400, 'SUBMISSION_FILE_REQUIRED', 'The Submission file is required.');
        }
        const normalizedFileUrl = String(fileUrl).trim();

        const assessmentRow = await this._findAssessmentById(submission.assessmentId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (assessment.type !== AssessmentType.ASSIGNMENT) {
            throw new AppError(409, 'SUBMISSION_FILE_NOT_EDITABLE', 'Files can only be edited for Assignment submissions.');
        }

        const canAcceptSubmission = assessment.canAcceptSubmission();
        const canEditSubmission =
            (submission.status === SubmissionStatus.IN_PROGRESS && canAcceptSubmission) ||
            (assessment.isOpen() && [SubmissionStatus.SUBMITTED, SubmissionStatus.PENDING_REVIEW].includes(submission.status));

        if (!canEditSubmission) {
            throw new AppError(409, 'SUBMISSION_NOT_EDITABLE', 'This Submission can no longer be changed.');
        }

        const existingFileUrls = Array.isArray(submission.uploadedFileUrls) ? submission.uploadedFileUrls : [];
        if (!existingFileUrls.includes(normalizedFileUrl)) {
            throw new AppError(404, 'SUBMISSION_FILE_NOT_FOUND', 'The Submission file could not be found.');
        }

        const expectedPrefix = `submissions/${submissionId}/`;
        if (!normalizedFileUrl.startsWith(expectedPrefix)) {
            throw new AppError(403, 'SUBMISSION_FILE_ACCESS_DENIED', 'The file does not belong to this Submission.');
        }

        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        const { error: storageError } = await supabase.storage.from(bucket).remove([normalizedFileUrl]);
        if (storageError) throw storageError;

        const updatedFileUrls = existingFileUrls.filter(item => item !== normalizedFileUrl);
        const { data, error: updateError } = await supabase
            .from('Submission')
            .update({ uploadedFileUrls: updatedFileUrls })
            .eq('submissionId', submissionId)
            .select()
            .single();

        if (updateError) throw updateError;

        return {
            submission: this._toSubmission(data),
            uploadedFileUrls: updatedFileUrls
        };
    }

    static async getLearnerAssessmentReview(assessmentId, learnerId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertLearnerEnrolled(assessmentRow.courseId, learnerId);
        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        const questions = await this._loadQuestionsWithOptions(assessmentId, false);

        const { data: submissionRow, error: submissionError } = await supabase
            .from('Submission')
            .select('*')
            .eq('assessmentId', assessmentId)
            .eq('learnerId', learnerId)
            .maybeSingle();

        if (submissionError) throw submissionError;

        const finalizedStatuses = [
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.PENDING_REVIEW,
            SubmissionStatus.GRADED
        ];

        const hasFinalizedSubmission = submissionRow && finalizedStatuses.includes(submissionRow.status);
        const assessmentClosed = assessment.status === AssessmentStatus.CLOSED;

        // If late submission is disabled, an unfinished attempt expires at the deadline.
        // Remove it and do not expose a review page for work that was never submitted.
        if (
            submissionRow &&
            submissionRow.status === SubmissionStatus.IN_PROGRESS &&
            assessmentClosed &&
            !assessment.allowLateSubmission
        ) {
            await this._discardSubmission(submissionRow);
            throw new AppError(
                409,
                'ASSESSMENT_NOT_REVIEWABLE',
                'This Assessment was not submitted before the deadline and cannot be reviewed.'
            );
        }

        if (!hasFinalizedSubmission) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_REVIEWABLE',
                assessmentClosed
                    ? 'This Assessment was not submitted before the deadline and cannot be reviewed.'
                    : 'This Assessment cannot be reviewed yet.'
            );
        }

        const { data: answerRows, error: answerError } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq('submissionId', submissionRow.submissionId);

        if (answerError) throw answerError;

        const submission = this._toSubmission(submissionRow);

        return {
            assessment,
            questions,
            submission,
            answers: (answerRows || []).map(row => new SubmissionAnswer(row)),
            files: Array.isArray(submission.uploadedFileUrls)
                ? await Promise.all(
                    submission.uploadedFileUrls.map(
                        filePath => this._getSubmissionFileAccessUrl(filePath)
                    )
                )
                : []
        };
    }

    static async submitSubmission(submissionId, learnerId) {
        const submissionRow = await this._assertOwnedSubmission(submissionId, learnerId);
        const assessmentRow = await this._findAssessmentById(submissionRow.assessmentId);

        if (!assessmentRow.startTime || !assessmentRow.deadline) {
            throw new AppError(
                409,
                'ASSESSMENT_SCHEDULE_NOT_CONFIGURED',
                'This Assessment does not have a valid submission schedule.'
            );
        }

        const startTime = new Date(assessmentRow.startTime);
        const deadline = new Date(assessmentRow.deadline);

        if (Number.isNaN(startTime.getTime()) || Number.isNaN(deadline.getTime()) || startTime >= deadline) {
            throw new AppError(
                500,
                'INVALID_ASSESSMENT_SCHEDULE',
                'The Assessment contains an invalid submission schedule.'
            );
        }

        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);
        const now = new Date();

        // Check the schedule before interpreting the Submission status. Otherwise a
        // late-disabled Assessment incorrectly reports ALREADY_FINALIZED after the
        // deadline instead of the actual late-submission error.
        if (now < startTime) {
            throw new AppError(409, 'ASSESSMENT_NOT_STARTED', 'This Assessment has not started yet.');
        }
        if (now > deadline && !assessmentRow.allowLateSubmission) {
            if (submissionRow.status === SubmissionStatus.IN_PROGRESS) {
                await this._discardSubmission(submissionRow);
            }
            throw new AppError(
                409,
                'LATE_SUBMISSION_NOT_ALLOWED',
                'The deadline has passed. This unfinished attempt was discarded because late submission is not allowed.'
            );
        }

        const canAcceptSubmission = assessment.canAcceptSubmission(now);
        const quizCanSubmit =
            assessment.type === AssessmentType.QUIZ &&
            canAcceptSubmission &&
            submissionRow.status === SubmissionStatus.IN_PROGRESS;

        const assignmentCanSubmit =
            assessment.type === AssessmentType.ASSIGNMENT &&
            ((submissionRow.status === SubmissionStatus.IN_PROGRESS && canAcceptSubmission) ||
             (assessment.isOpen(now) && [SubmissionStatus.SUBMITTED, SubmissionStatus.PENDING_REVIEW].includes(submissionRow.status)));

        if (!quizCanSubmit && !assignmentCanSubmit) {
            throw new AppError(
                409,
                'SUBMISSION_ALREADY_FINALIZED',
                'This Submission can no longer be submitted or changed.'
            );
        }

        const questions = await this._loadQuestionsWithOptions(assessmentRow.assessmentId, true);

        const { data: answers, error: answerError } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq('submissionId', submissionId);

        if (answerError) throw answerError;

        const uploadedFileUrls = Array.isArray(submissionRow.uploadedFileUrls)
            ? submissionRow.uploadedFileUrls
            : [];

        const canAutoGrade =
            assessmentRow.type === AssessmentType.QUIZ &&
            questions.length > 0 &&
            questions.every(question => question.isAutoGradable()) &&
            uploadedFileUrls.length === 0;

        let status = SubmissionStatus.PENDING_REVIEW;
        let score = null;

        if (canAutoGrade) {
            const answerByQuestionId = new Map(
                (answers || []).map(answer => [answer.questionId, answer.response])
            );
            score = questions.reduce((total, question) => {
                const response = answerByQuestionId.get(question.questionId);
                return total + question.grade(response);
            }, 0);
            status = SubmissionStatus.GRADED;
        }

        // Re-check using the server clock immediately before the final write. The
        // deadline may have passed while answers/questions were being loaded.
        const finalizeNow = new Date();
        const isLate = finalizeNow > deadline;
        if (isLate && !assessmentRow.allowLateSubmission) {
            if (submissionRow.status === SubmissionStatus.IN_PROGRESS) {
                await this._discardSubmission(submissionRow);
            }
            throw new AppError(
                409,
                'LATE_SUBMISSION_NOT_ALLOWED',
                'The deadline passed before submission completed. This unfinished attempt was discarded.'
            );
        }
        const submittedAt = finalizeNow.toISOString();

        let updateQuery = supabase
            .from('Submission')
            .update({
                submittedAt,
                late: isLate,
                status,
                score
            })
            .eq('submissionId', submissionId)
            .eq('learnerId', learnerId)
            .eq('status', submissionRow.status);

        // Optimistic concurrency: two simultaneous finalize requests that read the
        // same old row cannot both succeed, even when the resulting status value is
        // the same (for example PENDING_REVIEW -> PENDING_REVIEW on an Assignment).
        if (submissionRow.submittedAt) {
            updateQuery = updateQuery.eq('submittedAt', submissionRow.submittedAt);
        } else {
            updateQuery = updateQuery.is('submittedAt', null);
        }

        const { data, error } = await updateQuery
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new AppError(
                409,
                'SUBMISSION_ALREADY_FINALIZED',
                'This Submission was already finalized by another request.'
            );
        }

        let analytics = null;
        if (status === SubmissionStatus.GRADED) {
            analytics = await AssessmentAnalyticsIntegrationService.recordAssessmentScore({
                learnerId,
                courseId: assessmentRow.courseId,
                assessmentId: assessmentRow.assessmentId,
                score
            });
        }

        return {
            submission: this._toSubmission(data),
            analytics
        };
    }

    static async getLearnerAssessments(learnerId) {
        const { data: enrollments, error: enrollmentError } = await supabase
        .from('Enrollment')
        .select('courseId')
        .eq('learnerId', learnerId)
        .eq('status', EnrollmentStatus.APPROVED);

        if (enrollmentError) {
        console.error('[AssessmentService] Enrollment fetch error:', enrollmentError);
        throw new AppError(500, 'DB_ERROR', 'Failed to fetch enrolled courses.');
        }

        const courseIds = [...new Set((enrollments || []).map((item) => item.courseId))].filter(Boolean);
        if (courseIds.length === 0) return [];

        const { data: assessmentRows, error: assessmentError } = await supabase
        .from('Assessment')
        .select('*')
        .in('courseId', courseIds)
        .order('startTime', { ascending: true });

        if (assessmentError) {
        console.error('[AssessmentService] Assessments fetch error:', assessmentError);
        throw new AppError(500, 'DB_ERROR', 'Failed to fetch assessments.');
        }

        const assessmentIds = (assessmentRows || []).map((row) => row.assessmentId).filter(Boolean);
        const submissionByAssessmentId = new Map();

        if (assessmentIds.length > 0) {
        const { data: submissionRows, error: submissionError } = await supabase
            .from('Submission')
            .select('*')
            .eq('learnerId', learnerId)
            .in('assessmentId', assessmentIds);

        if (!submissionError && submissionRows) {
            for (const submissionRow of submissionRows) {
            submissionByAssessmentId.set(String(submissionRow.assessmentId), submissionRow);
            }
        }
        }

        const assessments = [];
        for (const row of assessmentRows || []) {
        const synchronized = await this._synchronizeAssessmentStatus(row);
        const assessment = this._toAssessment(synchronized);

        if (assessment && assessment.status !== AssessmentStatus.DRAFT) {
            let submissionRow = submissionByAssessmentId.get(String(assessment.assessmentId)) || null;

            if (
                submissionRow &&
                submissionRow.status === SubmissionStatus.IN_PROGRESS &&
                assessment.status === AssessmentStatus.CLOSED &&
                !assessment.allowLateSubmission
            ) {
                await this._discardSubmission(submissionRow);
                submissionRow = null;
            }

            assessments.push({
            ...assessment,
            submission: submissionRow
                ? {
                    submissionId: submissionRow.submissionId,
                    status: submissionRow.status,
                    startedAt: submissionRow.startedAt,
                    submittedAt: submissionRow.submittedAt,
                    late: Boolean(submissionRow.late || submissionRow.isLate),
                    score: submissionRow.score
                }
                : null
            });
        }
        }

        return assessments;
    }

    static async gradeSubmission(submissionId, educatorId, score, feedback = null) {
        const { data: submission, error: submissionError } = await supabase
            .from('Submission')
            .select('*')
            .eq('submissionId', submissionId)
            .maybeSingle();

        if (submissionError) throw submissionError;
        if (!submission) {
            throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'The Submission could not be found.');
        }

        const assessment = await this._findAssessmentById(submission.assessmentId);
        const synchronized = await this._synchronizeAssessmentStatus(assessment);
        const currentAssessment = this._toAssessment(synchronized);

        if (currentAssessment.type === AssessmentType.ASSIGNMENT && currentAssessment.status !== AssessmentStatus.CLOSED) {
            throw new AppError(
                409,
                'ASSESSMENT_STILL_OPEN',
                'This Assignment cannot be graded until its submission period has closed.'
            );
        }

        await this._assertCourseManagedBy(assessment.courseId, educatorId);

        const editableStatuses = [
            SubmissionStatus.PENDING_REVIEW,
            SubmissionStatus.GRADED
        ];

        if (!editableStatuses.includes(submission.status)) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_AVAILABLE_FOR_GRADING',
                'Only a Submission pending review or already graded can be graded manually.'
            );
        }

        const numericScore = Number(score);
        if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > Number(assessment.totalPoints)) {
            throw new AppError(400, 'INVALID_SUBMISSION_SCORE', 'The score is outside the valid range.');
        }

        const { data, error } = await supabase
            .from('Submission')
            .update({
                status: SubmissionStatus.GRADED,
                score: numericScore,
                feedback
            })
            .eq('submissionId', submissionId)
            .select()
            .single();

        if (error) throw error;

        const analytics = await AssessmentAnalyticsIntegrationService.recordAssessmentScore({
            learnerId: data.learnerId,
            courseId: assessment.courseId,
            assessmentId: assessment.assessmentId,
            score: numericScore
        });

        return {
            submission: this._toSubmission(data),
            analytics
        };
    }

    static _assertQuestionPointsMatchTotal(totalPoints, questions = []) {
        if (!Array.isArray(questions) || questions.length === 0) {
            return;
        }

        const normalizedPoints = questions.map(question => Number(question?.points));
        if (normalizedPoints.some(points => !Number.isFinite(points) || points <= 0)) {
            throw new AppError(
                400,
                'INVALID_QUESTION_POINTS',
                'Each Question must have points greater than 0.'
            );
        }

        const questionPointsTotal = normalizedPoints.reduce((sum, points) => sum + points, 0);
        if (Math.abs(questionPointsTotal - Number(totalPoints)) > 0.001) {
            throw new AppError(
                400,
                'QUESTION_POINTS_TOTAL_MISMATCH',
                `The sum of Question points (${questionPointsTotal}) must equal the Assessment total points (${Number(totalPoints)}).`
            );
        }
    }

    static async _assertStoredQuestionsReadyForPublish(assessmentId, totalPoints, assessmentType) {
        const { data, error } = await supabase
            .from('Question')
            .select('content, points, type, options, correctAnswer')
            .eq('assessmentId', assessmentId);

        if (error) throw error;

        const questions = data || [];
        if (questions.length === 0) {
            throw new AppError(
                400,
                'ASSESSMENT_QUESTION_REQUIRED',
                'Add at least one Question before publishing the Assessment.'
            );
        }

        const expectedQuestionType = this._getExpectedQuestionType(assessmentType);
        for (const question of questions) {
            this._assertQuestionTypeMatchesAssessment(
                question.type,
                expectedQuestionType,
                assessmentType
            );

            if (!String(question.content || '').trim()) {
                throw new AppError(400, 'QUESTION_CONTENT_REQUIRED', 'Question content cannot be empty.');
            }

            if (expectedQuestionType === QuestionType.MULTIPLE_CHOICE) {
                const optionContents = Array.isArray(question.options)
                    ? question.options.map(option => String(option || '').trim())
                    : [];

                if (optionContents.length < 2 || optionContents.some(content => !content)) {
                    throw new AppError(400, 'INVALID_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice option content cannot be empty.');
                }

                if (new Set(optionContents.map(content => content.toLowerCase())).size !== optionContents.length) {
                    throw new AppError(400, 'DUPLICATE_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice options must be unique.');
                }

                const correctAnswer = String(question.correctAnswer || '').trim();
                if (!correctAnswer || optionContents.filter(content => content === correctAnswer).length !== 1) {
                    throw new AppError(400, 'INVALID_CORRECT_OPTION', 'Select exactly one correct option.');
                }
            }
        }

        this._assertQuestionPointsMatchTotal(totalPoints, questions);
    }

    static _getExpectedQuestionType(assessmentType) {
        if (assessmentType === AssessmentType.QUIZ) {
            return QuestionType.MULTIPLE_CHOICE;
        }
        if (assessmentType === AssessmentType.ASSIGNMENT) {
            return QuestionType.ESSAY;
        }
        throw new AppError(
            400,
            'INVALID_ASSESSMENT_TYPE',
            'The supplied Assessment type is invalid.'
        );
    }

    static _assertQuestionTypeMatchesAssessment(questionType, expectedQuestionType, assessmentType) {
        if (questionType === expectedQuestionType) return;

        const expectedLabel = expectedQuestionType === QuestionType.MULTIPLE_CHOICE
            ? 'Multiple Choice'
            : 'Essay';
        const assessmentLabel = assessmentType === AssessmentType.QUIZ
            ? 'Quiz'
            : 'Assignment';

        throw new AppError(
            400,
            'QUESTION_TYPE_NOT_ALLOWED_FOR_ASSESSMENT',
            `${assessmentLabel} assessments can only contain ${expectedLabel} Questions.`
        );
    }

    static _validateTotalPoints(value) {
        const isValidType = typeof value === 'number' || typeof value === 'string';
        if (!isValidType || (typeof value === 'string' && !value.trim())) {
            throw new AppError(400, 'INVALID_TOTAL_POINTS', 'Assessment total points must be a non-negative number.');
        }
        const numericTotalPoints = Number(value);
        if (!Number.isFinite(numericTotalPoints) || numericTotalPoints < 0) {
            throw new AppError(400, 'INVALID_TOTAL_POINTS', 'Assessment total points must be a non-negative number.');
        }
        return numericTotalPoints;
    }

    static _generateSafeFileName(originalName) {
        const normalizedName = String(originalName || 'instruction-file').replace(/\\/g, '/');
        const baseName = path.posix.basename(normalizedName);
        const safeBaseName = baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
        return `${crypto.randomUUID()}__${safeBaseName}`;
    }

    static async _insertQuestion(assessmentId, questionInput) {
        const { type, points = 0, displayOrder = 0, options = [] } = questionInput || {};
        const content = String(questionInput?.content || '').trim();
        if (!content) {
            throw new AppError(400, 'QUESTION_CONTENT_REQUIRED', 'Question content cannot be empty.');
        }
        if (!Object.values(QuestionType).includes(type)) {
            throw new AppError(400, 'INVALID_QUESTION_DATA', 'Question type is required.');
        }
        const numericQuestionPoints = Number(points);
        if (!Number.isFinite(numericQuestionPoints) || numericQuestionPoints <= 0) {
            throw new AppError(400, 'INVALID_QUESTION_POINTS', 'Question points must be greater than 0.');
        }
        let optionContents = [];
        let correctAnswer = null;
        if (type === QuestionType.MULTIPLE_CHOICE) {
            if (!Array.isArray(options)) {
                throw new AppError(400, 'INVALID_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice options must be an array.');
            }
            const normalizedOptions = options.map(option => ({
                content: String(option?.content || '').trim(),
                isCorrect: option?.isCorrect === true
            }));
            const correctOptions = normalizedOptions.filter(option => option.isCorrect);
            if (normalizedOptions.length < 2 || normalizedOptions.some(option => !option.content)) {
                throw new AppError(400, 'INVALID_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice option content cannot be empty.');
            }
            if (new Set(normalizedOptions.map(option => option.content.toLowerCase())).size !== normalizedOptions.length) {
                throw new AppError(400, 'DUPLICATE_MULTIPLE_CHOICE_OPTIONS', 'Multiple-choice options must be unique.');
            }
            if (correctOptions.length !== 1) {
                throw new AppError(400, 'INVALID_CORRECT_OPTION', 'Select exactly one correct option.');
            }
            optionContents = normalizedOptions.map(option => option.content);
            correctAnswer = correctOptions[0].content;
        }
        const { data, error } = await supabase
            .from('Question')
            .insert({
                assessmentId,
                content,
                type,
                options: optionContents,
                correctAnswer,
                points: numericQuestionPoints,
                displayOrder
            })
            .select()
            .single();

        if (error) throw error;
        return new Question(data);
    }

    static async _loadQuestionsWithOptions(assessmentId, includeCorrect) {
        const { data, error } = await supabase
            .from('Question')
            .select('*')
            .eq('assessmentId', assessmentId)
            .order('displayOrder', { ascending: true });

        if (error) throw error;

        return (data || []).map(row =>
            new Question({
                questionId: row.questionId,
                assessmentId: row.assessmentId,
                content: row.content,
                type: row.type,
                options: row.options || [],
                correctAnswer: includeCorrect ? row.correctAnswer : null,
                points: row.points,
                displayOrder: row.displayOrder
            })
        );
    }

    static async _findAssessmentById(assessmentId) {
        const { data, error } = await supabase
            .from('Assessment')
            .select('*')
            .eq('assessmentId', assessmentId)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new AppError(404, 'ASSESSMENT_NOT_FOUND', 'The Assessment could not be found.');
        }
        return data;
    }

    static async _assertCourseManagedBy(courseId, educatorId) {
        const { data, error } = await supabase
            .from('Course')
            .select('courseId, educatorId')
            .eq('courseId', courseId)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new AppError(404, 'COURSE_NOT_FOUND', 'The Course could not be found.');
        }
        if (data.educatorId !== educatorId) {
            throw new AppError(403, 'COURSE_ACCESS_DENIED', 'Only the Educator managing this Course may manage its Assessments.');
        }
        return data;
    }

    static async _assertLearnerEnrolled(courseId, learnerId) {
        const { data, error } = await supabase
            .from('Enrollment')
            .select('enrollmentId, status')
            .eq('courseId', courseId)
            .eq('learnerId', learnerId)
            .eq('status', EnrollmentStatus.APPROVED)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new AppError(403, 'COURSE_MEMBERSHIP_REQUIRED', 'You must be an approved member of the Course to access this Assessment.');
        }
        return data;
    }

    static async _discardExpiredDraftsForAssessment(assessmentId) {
        const { data: drafts, error } = await supabase
            .from('Submission')
            .select('*')
            .eq('assessmentId', assessmentId)
            .eq('status', SubmissionStatus.IN_PROGRESS);

        if (error) throw error;
        for (const draft of drafts || []) {
            await this._discardSubmission(draft);
        }
    }

    static async _discardSubmission(submissionRow) {
        if (!submissionRow?.submissionId) return;
        const submissionId = submissionRow.submissionId;
        const uploadedFileUrls = Array.isArray(submissionRow.uploadedFileUrls)
            ? submissionRow.uploadedFileUrls.filter(Boolean)
            : [];

        // Remove uploaded assignment files first. Storage cleanup is best-effort; DB
        // cleanup must still happen so an expired attempt cannot appear as submitted work.
        if (uploadedFileUrls.length > 0) {
            try {
                const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
                const { error: storageError } = await supabase.storage
                    .from(bucket)
                    .remove(uploadedFileUrls);
                if (storageError) {
                    console.warn('[AssessmentService] Failed to remove expired submission files:', storageError.message);
                }
            } catch (storageError) {
                console.warn('[AssessmentService] Failed to remove expired submission files:', storageError.message);
            }
        }

        const { error: answerError } = await supabase
            .from('SubmissionAnswer')
            .delete()
            .eq('submissionId', submissionId);
        if (answerError) throw answerError;

        const { error: submissionError } = await supabase
            .from('Submission')
            .delete()
            .eq('submissionId', submissionId)
            .eq('status', SubmissionStatus.IN_PROGRESS);
        if (submissionError) throw submissionError;
    }

    static async _assertOwnedSubmission(submissionId, learnerId) {
        const { data, error } = await supabase
            .from('Submission')
            .select('*')
            .eq('submissionId', submissionId)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'The Submission could not be found.');
        }
        return data;
    }

    static _validateSchedule(startTime, deadline) {
        const start = new Date(startTime);
        const end = new Date(deadline);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new AppError(400, 'INVALID_ASSESSMENT_SCHEDULE', 'The Assessment deadline must be after the start time.');
        }
    }

    static async _synchronizeAssessmentStatus(assessmentRow) {
        if (!assessmentRow || assessmentRow.status === AssessmentStatus.DRAFT || !assessmentRow.startTime || !assessmentRow.deadline) {
        return assessmentRow;
        }
        const now = new Date();
        const start = new Date(assessmentRow.startTime);
        const deadline = new Date(assessmentRow.deadline);

        let nextStatus = AssessmentStatus.SCHEDULED;
        if (now >= start && now <= deadline) {
        nextStatus = AssessmentStatus.IN_PROGRESS;
        } else if (now > deadline) {
        nextStatus = AssessmentStatus.CLOSED;
        }

        if (nextStatus === assessmentRow.status) {
        return assessmentRow;
        }

        // Cố gắng cập nhật trạng thái mới vào DB, nếu gặp lỗi phân quyền (RLS) thì fallback về object in-memory
        try {
        const { data, error } = await supabase
            .from('Assessment')
            .update({ status: nextStatus })
            .eq('assessmentId', assessmentRow.assessmentId)
            .select()
            .single();

        if (!error && data) {
            return data;
        }
        } catch (e) {
        console.warn('[AssessmentService] Could not update sync status in DB, fallback in-memory:', e.message);
        }

        return { ...assessmentRow, status: nextStatus };
    }

    static async _notifyCourseLearners({ courseId, assessmentId, action }) {
        return NotificationService.notifyAssessmentChanged({
            courseId,
            assessmentId,
            action
        });
    }

    static _toAssessment(row) {
        return new Assessment({
            assessmentId: row.assessmentId,
            courseId: row.courseId,
            title: row.title,
            description: row.description,
            type: row.type,
            instructionFileUrl: this._getInstructionFilePublicUrl(row.instructionFileUrl),
            instructionFileName: this._getInstructionFileName(row.instructionFileUrl),
            startTime: row.startTime,
            deadline: row.deadline,
            totalPoints: row.totalPoints,
            allowLateSubmission: row.allowLateSubmission,
            status: row.status,
            createdAt: row.createdAt
        });
    }

    static _toSubmission(row) {
        return new Submission({
            submissionId: row.submissionId,
            assessmentId: row.assessmentId,
            learnerId: row.learnerId,
            status: row.status,
            startedAt: row.startedAt,
            submittedAt: row.submittedAt,
            late: row.late,
            score: row.score,
            feedback: row.feedback,
            uploadedFileUrls: Array.isArray(row.uploadedFileUrls) ? row.uploadedFileUrls : []
        });
    }

    static _getInstructionFilePublicUrl(instructionFilePath) {
        if (!instructionFilePath) return null;
        if (/^https?:\/\//i.test(instructionFilePath)) {
            return instructionFilePath;
        }
        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(instructionFilePath);
        return data?.publicUrl || instructionFilePath;
    }

    static _getInstructionFileName(instructionFilePath) {
        if (!instructionFilePath) return null;
        try {
            const cleanValue = decodeURIComponent(String(instructionFilePath).split('?')[0]);
            const storedName = cleanValue.split('/').pop();
            if (!storedName) return null;
            const separatorIndex = storedName.indexOf('__');
            if (separatorIndex !== -1) {
                return storedName.slice(separatorIndex + 2);
            }
            return 'Assessment instruction file';
        } catch {
            return 'Assessment instruction file';
        }
    }

    static async _getSubmissionFileAccessUrl(filePath) {
        if (!filePath) return null;
        if (/^https?:\/\//i.test(filePath)) {
            return filePath;
        }

        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 60 * 60);

        if (error) {
            throw new AppError(
                404,
                'SUBMISSION_FILE_NOT_AVAILABLE',
                'The submitted file is no longer available.'
            );
        }

        return data?.signedUrl || filePath;
    }

    static _getSubmissionFilePublicUrl(filePath) {
        if (!filePath) return null;
        if (/^https?:\/\//i.test(filePath)) {
            return filePath;
        }
        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET || 'materials';
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
        return data?.publicUrl || filePath;
    }
}

module.exports = AssessmentService;