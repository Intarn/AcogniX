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
    // UC-09: Create an official quiz or assignment in a managed Course 
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

        const savedQuestions = [];
        for(const questionInput of questions) {
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
        })
        return {
            assessment: this._toAssessment(data), 
            questions: savedQuestions
        };
    }

    // UC-09: List Assessments in a Course managed by the Educator
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

    // UC-09: Get one Assessment managed by the curent Educator
    static async getAssessmentById(
        assessmentId,
        educatorId
    ) {
        const assessmentRow =
            await this._findAssessmentById(
                assessmentId
            );

        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );

        const synchronized =
            await this._synchronizeAssessmentStatus(
                assessmentRow
            );

        return this._toAssessment(
            synchronized
        );
    }

    // UC-09: Get Questions for Educator view
    static async getAssessmentQuestions(
        assessmentId,
        educatorId
    ) {
        const assessmentRow =
            await this._findAssessmentById(
                assessmentId
            );

        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );

        return this._loadQuestionsWithOptions(
            assessmentId,
            true
        );
    }

    // UC-09: Get all Submissions of an Assessment
    static async getAssessmentSubmissions(
        assessmentId,
        educatorId
    ) {
        const assessmentRow =
            await this._findAssessmentById(
                assessmentId
            );

        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );

        const {
            data,
            error
        } = await supabase
            .from('Submission')
            .select('*')
            .eq(
                'assessmentId',
                assessmentId
            )
            .order(
                'submittedAt',
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        return (data || []).map(
            row =>
                this._toSubmission(
                    row
                )
        );
    }

    // UC-09: Educator reviews one Submission
    static async getSubmissionById(
        submissionId,
        educatorId
    ) {
        
        // Find Submission
        const {
            data: submissionRow,
            error: submissionError
        } = await supabase
            .from('Submission')
            .select('*')
            .eq(
                'submissionId',
                submissionId
            )
            .maybeSingle();

        if (submissionError) {
            throw submissionError;
        }

        if (!submissionRow) {
            throw new AppError(
                404,
                'SUBMISSION_NOT_FOUND',
                'The Submission could not be found.'
            );
        }


        // Find its Assessment
        const assessmentRow =
            await this._findAssessmentById(
                submissionRow.assessmentId
            );



        // Verify Educator owns Course
        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );

        // 4. Load answers
        const {
            data: answerRows,
            error: answerError
        } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq(
                'submissionId',
                submissionId
            );

        if (answerError) {
            throw answerError;
        }


        // 5. Load Learner information
        const {
            data: learner,
            error: learnerError
        } = await supabase
            .from('User')
            .select(
                'userId, email, displayName, avatarUrl'
            )
            .eq(
                'userId',
                submissionRow.learnerId
            )
            .maybeSingle();

        if (learnerError) {
            throw learnerError;
        }


        const submission =
            this._toSubmission(
                submissionRow
            );


        return {
            submission,

            learner:
                learner || null,

            answers:
                (answerRows || []).map(
                    row =>
                        new SubmissionAnswer(
                            row
                        )
                ),

            files:
                Array.isArray(
                    submission.uploadedFileUrls
                )
                    ? submission.uploadedFileUrls
                    : []
        };
    }

    // UC-09: Alternative Flow 1: Active Assessments cannot be edited.
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
            updateData.type = changes.type;
        }

        if (changes.totalPoints !== undefined) {
            updateData.totalPoints = this._validateTotalPoints(changes.totalPoints);
        }

        if (changes.allowLateSubmission !== undefined) {
            updateData.allowLateSubmission = Boolean(changes.allowLateSubmission);
        }

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

    // UC-09 Alternative Flow: 1 Active Assessments cannot be deleted
    static async deleteAssessment(assessmentId, educatorId) {
        // 1. Tìm Assessment
        const assessmentRow = await this._findAssessmentById(
            assessmentId
        );

        // 2. Kiểm tra Educator có quản lý Course này không
        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );

        // 3. Đồng bộ status hiện tại
        const synchronized =
            await this._synchronizeAssessmentStatus(
                assessmentRow
            );

        const assessment = this._toAssessment(
            synchronized
        );

        // 4. Chỉ Assessment còn editable mới được xóa
        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'An active or closed Assessment cannot be deleted.'
            );
        }

        // 5. Xóa Assessment.
        // Question, Submission, SubmissionAnswer
        // sẽ được database tự động xóa nhờ ON DELETE CASCADE.
        const { error } = await supabase
            .from('Assessment')
            .delete()
            .eq('assessmentId', assessmentId);

        if (error) {
            throw error;
        }

        // 6. Thông báo cho Learners
        await this._notifyCourseLearners({
            courseId: assessmentRow.courseId,
            assessmentId,
            action: 'DELETED'
        });
    }

    // UC-09: Add a Questin before the Assessment becomes active.
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

        return this._insertQuestion(assessmentId, questionInput);
    }

    static async updateQuestion(
        assessmentId,
        questionId,
        educatorId,
        changes
    ) {
        // 1. Find Assessment
        const assessmentRow =
            await this._findAssessmentById(
                assessmentId
            );

        // 2. Verify that the current Educator manages the Course
        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );

        // 3. Synchronize Assessment status
        const synchronized =
            await this._synchronizeAssessmentStatus(
                assessmentRow
            );

        const assessment =
            this._toAssessment(synchronized);

        // 4. Active / closed Assessment cannot be edited
        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'An active or closed Assessment cannot be edited.'
            );
        }

        // 5. Find the Question and make sure it belongs
        //    to this Assessment
        const { data: questionRow, error: questionError } =
            await supabase
                .from('Question')
                .select('*')
                .eq('questionId', questionId)
                .eq('assessmentId', assessmentId)
                .maybeSingle();

        if (questionError) {
            throw questionError;
        }

        if (!questionRow) {
            throw new AppError(
                404,
                'QUESTION_NOT_FOUND',
                'The Question could not be found in this Assessment.'
            );
        }

        // 6. Prepare update data
        const updateData = {};

        // ----- content -----
        if (changes.content !== undefined) {
            const content =
                String(changes.content).trim();

            if (!content) {
                throw new AppError(
                    400,
                    'QUESTION_CONTENT_REQUIRED',
                    'Question content cannot be empty.'
                );
            }

            updateData.content = content;
        }

        // ----- points -----
        if (changes.points !== undefined) {
            const points =
                Number(changes.points);

            if (
                !Number.isFinite(points) ||
                points < 0
            ) {
                throw new AppError(
                    400,
                    'INVALID_QUESTION_POINTS',
                    'Question points must be a non-negative number.'
                );
            }

            updateData.points = points;
        }

        // ----- display order -----
        if (changes.displayOrder !== undefined) {
            const displayOrder =
                Number(changes.displayOrder);

            if (
                !Number.isInteger(displayOrder) ||
                displayOrder < 0
            ) {
                throw new AppError(
                    400,
                    'INVALID_DISPLAY_ORDER',
                    'Question display order must be a non-negative integer.'
                );
            }

            updateData.displayOrder =
                displayOrder;
        }

        // Determine final Question type
        const finalType =
            changes.type !== undefined
                ? changes.type
                : questionRow.type;

        if (
            !Object.values(QuestionType)
                .includes(finalType)
        ) {
            throw new AppError(
                400,
                'INVALID_QUESTION_DATA',
                'The supplied Question type is invalid.'
            );
        }

        if (changes.type !== undefined) {
            updateData.type = finalType;
        }

        // 7. Handle MULTIPLE_CHOICE
        if (
            finalType ===
            QuestionType.MULTIPLE_CHOICE
        ) {
            // Only recalculate options when new options
            // are actually supplied.
            if (changes.options !== undefined) {
                if (!Array.isArray(changes.options)) {
                    throw new AppError(
                        400,
                        'INVALID_MULTIPLE_CHOICE_OPTIONS',
                        'Multiple-choice options must be an array.'
                    );
                }

                const correctOptions =
                    changes.options.filter(
                        option =>
                            option.isCorrect === true
                    );

                if (
                    changes.options.length < 2 ||
                    correctOptions.length !== 1
                ) {
                    throw new AppError(
                        400,
                        'INVALID_MULTIPLE_CHOICE_OPTIONS',
                        'A multiple-choice Question requires at least two options and exactly one correct option.'
                    );
                }

                const optionContents =
                    changes.options.map(option =>
                        String(
                            option.content || ''
                        ).trim()
                    );

                if (
                    optionContents.some(
                        content => !content
                    )
                ) {
                    throw new AppError(
                        400,
                        'INVALID_MULTIPLE_CHOICE_OPTIONS',
                        'Multiple-choice option content cannot be empty.'
                    );
                }

                updateData.options =
                    optionContents;

                updateData.correctAnswer =
                    String(
                        correctOptions[0].content
                    ).trim();
            }

            // ESSAY -> MULTIPLE_CHOICE requires options
            else if (
                questionRow.type !==
                QuestionType.MULTIPLE_CHOICE
            ) {
                throw new AppError(
                    400,
                    'INVALID_MULTIPLE_CHOICE_OPTIONS',
                    'Options are required when changing a Question to multiple choice.'
                );
            }
        }

        // 8. Handle ESSAY
        if (
            finalType === QuestionType.ESSAY &&
            questionRow.type !== QuestionType.ESSAY
        ) {
            updateData.options = [];
            updateData.correctAnswer = null;
        }

        // Nothing supplied
        if (
            Object.keys(updateData).length === 0
        ) {
            throw new AppError(
                400,
                'NO_QUESTION_CHANGES',
                'No Question changes were supplied.'
            );
        }

        // 9. Update DB
        const { data, error } =
            await supabase
                .from('Question')
                .update(updateData)
                .eq(
                    'questionId',
                    questionId
                )
                .eq(
                    'assessmentId',
                    assessmentId
                )
                .select()
                .single();

        if (error) {
            throw error;
        }

        // 10. Notify Learners if your UC-09
        // notification integration is enabled
        await this._notifyCourseLearners({
            courseId:
                assessmentRow.courseId,
            assessmentId,
            action: 'UPDATED'
        });

        return new Question(data);
    }

    static async deleteQuestion(
        assessmentId,
        questionId,
        educatorId
    ) {
        // 1. Find Assessment
        const assessmentRow =
            await this._findAssessmentById(
                assessmentId
            );


        // 2. Verify Educator manages this Course
        await this._assertCourseManagedBy(
            assessmentRow.courseId,
            educatorId
        );


        // 3. Synchronize Assessment status
        const synchronized =
            await this._synchronizeAssessmentStatus(
                assessmentRow
            );

        const assessment =
            this._toAssessment(
                synchronized
            );


        // 4. Active / closed Assessment
        // cannot have Questions changed
        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'Questions cannot be changed after the Assessment becomes active.'
            );
        }


        // 5. Make sure Question exists
        // and belongs to this Assessment
        const {
            data: questionRow,
            error: questionError
        } = await supabase
            .from('Question')
            .select(
                'questionId, assessmentId'
            )
            .eq(
                'questionId',
                questionId
            )
            .eq(
                'assessmentId',
                assessmentId
            )
            .maybeSingle();


        if (questionError) {
            throw questionError;
        }


        if (!questionRow) {
            throw new AppError(
                404,
                'QUESTION_NOT_FOUND',
                'The Question could not be found in this Assessment.'
            );
        }


        // 6. Delete Question
        const {
            error: deleteError
        } = await supabase
            .from('Question')
            .delete()
            .eq(
                'questionId',
                questionId
            )
            .eq(
                'assessmentId',
                assessmentId
            );


        if (deleteError) {
            throw deleteError;
        }


        // 7. Notify Learners
        await this._notifyCourseLearners({
            courseId:
                assessmentRow.courseId,

            assessmentId,

            action: 'UPDATED'
        });
    }

    // UC-09: Configure or change the Assessment schedule before it becomes active.
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

    // Supporting endpoint for Educator Gradebook
    static async getCourseGradebook(
        courseId,
        educatorId
    ) {
        /*
        * Verify Course ownership.
        */
        await this._assertCourseManagedBy(
            courseId,
            educatorId
        );


        /*
        * Load Course information.
        */
        const {
            data: course,
            error: courseError
        } = await supabase
            .from('Course')
            .select(
                'courseId, educatorId, subjectName, courseCode, description, status'
            )
            .eq(
                'courseId',
                courseId
            )
            .maybeSingle();

        if (courseError) {
            throw courseError;
        }


        /*
        * Load Assessments.
        */
        const assessments =
            await this.getManagedAssessments(
                courseId,
                educatorId
            );


        /*
        * Load approved Learners.
        */
        const {
            data: enrollments,
            error: enrollmentError
        } = await supabase
            .from('Enrollment')
            .select(
                'learnerId'
            )
            .eq(
                'courseId',
                courseId
            )
            .eq(
                'status',
                EnrollmentStatus.APPROVED
            );

        if (enrollmentError) {
            throw enrollmentError;
        }


        const learnerIds = [
            ...new Set(
                (enrollments || []).map(
                    item =>
                        item.learnerId
                )
            )
        ];


        let learners = [];

        if (learnerIds.length > 0) {
            const {
                data,
                error
            } = await supabase
                .from('User')
                .select(
                    'userId, email, displayName, avatarUrl'
                )
                .in(
                    'userId',
                    learnerIds
                );

            if (error) {
                throw error;
            }

            learners =
                data || [];
        }


        /*
        * Load all Submissions for all
        * Assessments in this Course.
        */
        const assessmentIds =
            assessments.map(
                assessment =>
                    assessment.assessmentId
            );


        let submissions = [];

        if (
            assessmentIds.length > 0
        ) {
            const {
                data,
                error
            } = await supabase
                .from('Submission')
                .select('*')
                .in(
                    'assessmentId',
                    assessmentIds
                );

            if (error) {
                throw error;
            }

            submissions =
                (data || []).map(
                    row =>
                        this._toSubmission(
                            row
                        )
                );
        }


        return {
            course,
            assessments,
            learners,
            submissions
        };
    }

    // Design-level operation from the Assessment Management class diagram 
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

        const now = new Date();
        const startTime = new Date(assessmentRow.startTime);
        const deadline = new Date(assessmentRow.deadline);

        let status = AssessmentStatus.SCHEDULED;
        if (now >= startTime && now <= deadline) {
            status = AssessmentStatus.IN_PROGRESS;
        } 
        else if (now > deadline) {
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

    // Optional implementation support for Assessment.instructionFileUrl.
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

        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET;
        if (!bucket) {
            throw new AppError(
                500,
                'ASSESSMENT_STORAGE_NOT_CONFIGURED',
                'Assessment storage is not configured.'
            );
        }

        const safeFileName = this._generateSafeFileName(file.originalname);
        const filePath = `instructions/${assessmentId}/${safeFileName}`;
        const { error: storageError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (storageError) throw storageError;

        const { data, error } = await supabase
            .from('Assessment')
            .update({ instructionFileUrl: filePath })
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

    // UC-10 Basic Flow Step 1: Learner opens an Assessment that is currently available 
    static async getOpenAssessment(assessmentId, learnerId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertLearnerEnrolled(assessmentRow.courseId, learnerId);

        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isOpen()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_OPEN',
                'This Assessment is not currently open.'
            );
        }

        const questions = await this._loadQuestionsWithOptions(
            assessmentId, 
            false
        );

        return {
            assessment, 
            questions
        };
    }

    // UC-10 Start at most one Submission for each Learner and Assessment 
    static async startSubmission(assessmentId, learnerId) {
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertLearnerEnrolled(assessmentRow.courseId, learnerId);

        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isOpen()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_OPEN',
                'This Assessment is not currently open.'
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

            /*
            * Quiz hoặc Assignment
            * đang làm dở.
            */
            if (
                existing.status ===
                SubmissionStatus.IN_PROGRESS
            ) {
                return this._toSubmission(
                    existing
                );
            }


            /*
            * Assignment đã submit nhưng
            * Assessment vẫn đang mở:
            *
            * Learner được phép quay lại
            * chỉnh sửa và resubmit.
            */
            const editableSubmittedAssignment =
                assessment.type ===
                    AssessmentType.ASSIGNMENT &&
                [
                    SubmissionStatus.SUBMITTED,
                    SubmissionStatus.PENDING_REVIEW
                ].includes(
                    existing.status
                );


            if (
                editableSubmittedAssignment
            ) {
                return this._toSubmission(
                    existing
                );
            }


            /*
            * Quiz đã submit,
            * hoặc Submission đã GRADED.
            */
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

    // UC-10 Basic Flow Step 2: Save on Learner response
    static async saveAnswer(submissionId, learnerId, questionId, response) {
        const submission = await this._assertOwnedSubmission(
            submissionId,
            learnerId
        );

        const assessmentRow =
            await this._findAssessmentById(
                submission.assessmentId
            );


        const synchronized =
            await this
                ._synchronizeAssessmentStatus(
                    assessmentRow
                );


        const assessment =
            this._toAssessment(
                synchronized
            );


        /*
        * Quiz:
        * editable only before submit.
        */
        const editableQuiz =
            assessment.type ===
                AssessmentType.QUIZ &&
            submission.status ===
                SubmissionStatus.IN_PROGRESS;


        /*
        * Assignment:
        * editable until Assessment
        * reaches its deadline.
        */
        const editableAssignment =
            assessment.type ===
                AssessmentType.ASSIGNMENT &&
            assessment.isOpen() &&
            [
                SubmissionStatus.IN_PROGRESS,
                SubmissionStatus.SUBMITTED,
                SubmissionStatus.PENDING_REVIEW
            ].includes(
                submission.status
            );


        if (
            !editableQuiz &&
            !editableAssignment
        ) {
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
            throw new AppError(
                404,
                'QUESTION_NOT_FOUND',
                'The Question does not belong to this Assessment.'
            );
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
        } 
        else {
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

    static async getSubmissionAnswers(
        submissionId,
        learnerId
    ) {
        /*
        * 1. Verify that this Submission
        * belongs to the current Learner.
        */
        const submission =
            await this._assertOwnedSubmission(
                submissionId,
                learnerId
            );


        /*
        * 2. Load all saved answers.
        */
        const {
            data: answerRows,
            error: answerError
        } =
            await supabase
                .from('SubmissionAnswer')
                .select('*')
                .eq(
                    'submissionId',
                    submission.submissionId
                );


        if (answerError) {
            throw answerError;
        }


        return (
            answerRows || []
        ).map(
            row =>
                new SubmissionAnswer(
                    row
                )
        );
    }

    // UC-10 Basic FLow step 2: Upload asignment files
    static async uploadFiles(
        submissionId,
        learnerId,
        files
    ) {
        /*
        * 1. Check Submission ownership.
        */
        const submission =
            await this._assertOwnedSubmission(
                submissionId,
                learnerId
            );


        /*
        * 2. Load Assessment.
        */
        const assessmentRow =
            await this._findAssessmentById(
                submission.assessmentId
            );


        const synchronized =
            await this
                ._synchronizeAssessmentStatus(
                    assessmentRow
                );


        const assessment =
            this._toAssessment(
                synchronized
            );


        /*
        * 3. Assessment must still
        * be open.
        */
        if (!assessment.isOpen()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_OPEN',
                'This Assessment is no longer open for editing.'
            );
        }


        /*
        * 4. Determine whether this
        * Submission is editable.
        */
        const editableAssignment =
            assessment.type ===
                AssessmentType.ASSIGNMENT &&
            [
                SubmissionStatus.IN_PROGRESS,
                SubmissionStatus.SUBMITTED,
                SubmissionStatus.PENDING_REVIEW
            ].includes(
                submission.status
            );


        const editableQuiz =
            assessment.type ===
                AssessmentType.QUIZ &&
            submission.status ===
                SubmissionStatus.IN_PROGRESS;


        if (
            !editableAssignment &&
            !editableQuiz
        ) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_EDITABLE',
                'This Submission can no longer be changed.'
            );
        }


        /*
        * 5. Require at least one file.
        */
        if (
            !files ||
            files.length === 0
        ) {
            throw new AppError(
                400,
                'SUBMISSION_FILES_REQUIRED',
                'Please select at least one file.'
            );
        }


        // 3. Phải có ít nhất một file
        if (!files || files.length === 0) {
            throw new AppError(
                400,
                'SUBMISSION_FILES_REQUIRED',
                'Please select at least one file.'
            );
        }

        // 4. Lấy tên bucket từ .env
        const bucket = process.env.ASSESSMENT_STORAGE_BUCKET;

        if (!bucket) {
            throw new AppError(
                500,
                'ASSESSMENT_STORAGE_NOT_CONFIGURED',
                'Assessment storage is not configured.'
            );
        }

        // Các file đã có trước đó trong Submission
        const existingFileUrls = Array.isArray(
            submission.uploadedFileUrls
        )
            ? submission.uploadedFileUrls
            : [];

        // Các file vừa upload trong request hiện tại
        const uploadedFiles = [];

        // 5. Upload từng file lên Supabase Storage
        for (const file of files) {
            const originalFileName =
                String(
                    file.originalname || 'file'
                )
                    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim();


            const storedFileName =
                `${crypto.randomUUID()}__${originalFileName}`;


            const filePath =
                `submissions/${submissionId}/${storedFileName}`;

            const { error: storageError } =
                await supabase.storage
                    .from(bucket)
                    .upload(
                        filePath,
                        file.buffer,
                        {
                            contentType: file.mimetype,
                            upsert: false
                        }
                    );

            if (storageError) {
                throw storageError;
            }

            // Không insert vào Submission_File nữa.
            // Chỉ giữ metadata tạm để trả về Controller.
            uploadedFiles.push({
                fileName: file.originalname,
                fileUrl: filePath,
                sizeBytes: file.size
            });
        }

        // 6. Ghép file cũ + file vừa upload
        const uploadedFileUrls = [
            ...existingFileUrls,
            ...uploadedFiles.map(file => file.fileUrl)
        ];

        // 7. Lưu toàn bộ URL vào Submission.uploadedFileUrls
        const { error: updateError } = await supabase
            .from('Submission')
            .update({
                uploadedFileUrls
            })
            .eq('submissionId', submissionId);

        if (updateError) {
            throw updateError;
        }

        // 8. Trả metadata của các file vừa upload
        return uploadedFiles;
    }

    static async deleteSubmissionFile(
        submissionId,
        learnerId,
        fileUrl
    ) {
        /*
        * 1. Check Submission ownership.
        */
        const submission =
            await this._assertOwnedSubmission(
                submissionId,
                learnerId
            );


        /*
        * 2. Validate file path.
        */
        if (
            !fileUrl ||
            !String(fileUrl).trim()
        ) {
            throw new AppError(
                400,
                'SUBMISSION_FILE_REQUIRED',
                'The Submission file is required.'
            );
        }


        const normalizedFileUrl =
            String(fileUrl).trim();


        /*
        * 3. Load Assessment.
        */
        const assessmentRow =
            await this._findAssessmentById(
                submission.assessmentId
            );


        const synchronized =
            await this
                ._synchronizeAssessmentStatus(
                    assessmentRow
                );


        const assessment =
            this._toAssessment(
                synchronized
            );


        /*
        * 4. Only ASSIGNMENT files
        * may be edited here.
        */
        if (
            assessment.type !==
            AssessmentType.ASSIGNMENT
        ) {
            throw new AppError(
                409,
                'SUBMISSION_FILE_NOT_EDITABLE',
                'Files can only be edited for Assignment submissions.'
            );
        }


        /*
        * 5. Assignment must still
        * be open.
        */
        if (!assessment.isOpen()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_OPEN',
                'This Assignment is no longer open for editing.'
            );
        }


        /*
        * 6. Submission must still
        * be editable.
        */
        const editableStatuses = [
            SubmissionStatus.IN_PROGRESS,
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.PENDING_REVIEW
        ];


        if (
            !editableStatuses.includes(
                submission.status
            )
        ) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_EDITABLE',
                'This Submission can no longer be changed.'
            );
        }


        /*
        * 7. Make sure this file
        * actually belongs to the
        * current Submission.
        */
        const existingFileUrls =
            Array.isArray(
                submission.uploadedFileUrls
            )
                ? submission.uploadedFileUrls
                : [];


        if (
            !existingFileUrls.includes(
                normalizedFileUrl
            )
        ) {
            throw new AppError(
                404,
                'SUBMISSION_FILE_NOT_FOUND',
                'The Submission file could not be found.'
            );
        }


        /*
        * Additional path safety.
        *
        * Every uploaded Assignment
        * file must live inside:
        *
        * submissions/<submissionId>/
        */
        const expectedPrefix =
            `submissions/${submissionId}/`;


        if (
            !normalizedFileUrl
                .startsWith(
                    expectedPrefix
                )
        ) {
            throw new AppError(
                403,
                'SUBMISSION_FILE_ACCESS_DENIED',
                'The file does not belong to this Submission.'
            );
        }


        /*
        * 8. Get Storage bucket.
        */
        const bucket =
            process.env
                .ASSESSMENT_STORAGE_BUCKET;


        if (!bucket) {
            throw new AppError(
                500,
                'ASSESSMENT_STORAGE_NOT_CONFIGURED',
                'Assessment storage is not configured.'
            );
        }


        /*
        * 9. Delete physical file
        * from Supabase Storage.
        */
        const {
            error: storageError
        } =
            await supabase
                .storage
                .from(bucket)
                .remove([
                    normalizedFileUrl
                ]);


        if (storageError) {
            throw storageError;
        }


        /*
        * 10. Remove path from
        * Submission.uploadedFileUrls.
        */
        const updatedFileUrls =
            existingFileUrls.filter(
                item =>
                    item !==
                    normalizedFileUrl
            );


        const {
            data,
            error: updateError
        } =
            await supabase
                .from('Submission')
                .update({
                    uploadedFileUrls:
                        updatedFileUrls
                })
                .eq(
                    'submissionId',
                    submissionId
                )
                .select()
                .single();


        if (updateError) {
            throw updateError;
        }


        return {
            submission:
                this._toSubmission(
                    data
                ),

            uploadedFileUrls:
                updatedFileUrls
        };
    }

    static async getLearnerAssessmentReview(
        assessmentId,
        learnerId
    ) {
        /*
        * 1. Find Assessment
        */
        const assessmentRow =
            await this._findAssessmentById(
                assessmentId
            );


        /*
        * 2. Learner must belong
        * to this Course.
        */
        await this._assertLearnerEnrolled(
            assessmentRow.courseId,
            learnerId
        );


        /*
        * 3. Synchronize current status.
        */
        const synchronized =
            await this
                ._synchronizeAssessmentStatus(
                    assessmentRow
                );


        const assessment =
            this._toAssessment(
                synchronized
            );


        


        /*
        * 5. Load questions.
        *
        * false:
        * do NOT expose correctAnswer.
        */
        const questions =
            await this
                ._loadQuestionsWithOptions(
                    assessmentId,
                    false
                );


        /*
        * 6. Find this Learner's
        * Submission.
        */
        const {
            data: submissionRow,
            error: submissionError
        } =
            await supabase
                .from('Submission')
                .select('*')
                .eq(
                    'assessmentId',
                    assessmentId
                )
                .eq(
                    'learnerId',
                    learnerId
                )
                .maybeSingle();


        if (submissionError) {
            throw submissionError;
        }

        const finalizedStatuses = [
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.PENDING_REVIEW,
            SubmissionStatus.GRADED
        ];


        const hasFinalizedSubmission =
            submissionRow &&
            finalizedStatuses.includes(
                submissionRow.status
            );


        const assessmentClosed =
            assessment.status ===
            AssessmentStatus.CLOSED;


        if (
            !assessmentClosed &&
            !hasFinalizedSubmission
        ) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_REVIEWABLE',
                'This Assessment cannot be reviewed yet.'
            );
        }


        /*
        * Learner may not have submitted
        * anything before the Assessment
        * was closed.
        */
        if (!submissionRow) {
            return {
                assessment,
                questions,
                submission: null,
                answers: [],
                files: []
            };
        }


        /*
        * 7. Load Learner's answers.
        */
        const {
            data: answerRows,
            error: answerError
        } =
            await supabase
                .from('SubmissionAnswer')
                .select('*')
                .eq(
                    'submissionId',
                    submissionRow
                        .submissionId
                );


        if (answerError) {
            throw answerError;
        }


        const submission =
            this._toSubmission(
                submissionRow
            );


        return {
            assessment,

            questions,

            submission,

            answers:
                (answerRows || []).map(
                    row =>
                        new SubmissionAnswer(
                            row
                        )
                ),

            files:
                Array.isArray(
                    submission.uploadedFileUrls
                )
                    ? submission.uploadedFileUrls
                    : []
        };
    }

    // UC-10 Basic Flow steps 3-5 and Alternative Flow 1
    static async submitSubmission(submissionId, learnerId) {
        // 1. Kiểm tra Submission thuộc Learner hiện tại
        const submissionRow = await this._assertOwnedSubmission(
            submissionId,
            learnerId
        );

        // 2. Submission chỉ được submit một lần
        

        // 3. Lấy Assessment tương ứng
        const assessmentRow = await this._findAssessmentById(
            submissionRow.assessmentId
        );

        const synchronized =
            await this
                ._synchronizeAssessmentStatus(
                    assessmentRow
                );

        
        const assessment =
            this._toAssessment(
                synchronized
            );


        const now =
            new Date();

        /*
        * Quiz:
        * only IN_PROGRESS Submission
        * may be submitted.
        */
        const quizCanSubmit =
            assessment.type ===
                AssessmentType.QUIZ &&
            submissionRow.status ===
                SubmissionStatus.IN_PROGRESS;


        /*
        * Assignment:
        * may be initially submitted
        * or resubmitted while the
        * Assessment is still open.
        */
        const assignmentCanSubmit =
            assessment.type ===
                AssessmentType.ASSIGNMENT &&
            assessment.isOpen(now) &&
            [
                SubmissionStatus.IN_PROGRESS,
                SubmissionStatus.SUBMITTED,
                SubmissionStatus.PENDING_REVIEW
            ].includes(
                submissionRow.status
            );


        if (
            !quizCanSubmit &&
            !assignmentCanSubmit
        ) {
            throw new AppError(
                409,
                'SUBMISSION_ALREADY_FINALIZED',
                'This Submission can no longer be submitted or changed.'
            );
        }

        const startTime = new Date(
            assessmentRow.startTime
        );

        const deadline = new Date(
            assessmentRow.deadline
        );

        // 4. Không cho submit trước giờ bắt đầu
        if (now < startTime) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_STARTED',
                'This Assessment has not started yet.'
            );
        }

        // 5. Kiểm tra nộp trễ
        const isLate = now > deadline;

        if (
            isLate &&
            !assessmentRow.allowLateSubmission
        ) {
            throw new AppError(
                409,
                'LATE_SUBMISSION_NOT_ALLOWED',
                'The deadline has passed and late submission is not allowed.'
            );
        }

        // 6. Load questions, có correctAnswer để backend chấm điểm
        const questions = await this._loadQuestionsWithOptions(
            assessmentRow.assessmentId,
            true
        );

        // 7. Load câu trả lời của Learner
        const {
            data: answers,
            error: answerError
        } = await supabase
            .from('SubmissionAnswer')
            .select('*')
            .eq('submissionId', submissionId);

        if (answerError) {
            throw answerError;
        }

        // 8. File không còn nằm trong Submission_File.
        // Đọc trực tiếp từ Submission.uploadedFileUrls.
        const uploadedFileUrls = Array.isArray(
            submissionRow.uploadedFileUrls
        )
            ? submissionRow.uploadedFileUrls
            : [];

        // 9. Xác định có thể auto-grade hay không
        const canAutoGrade = (
            assessmentRow.type === AssessmentType.QUIZ &&
            questions.length > 0 &&
            questions.every(
                question => question.isAutoGradable()
            ) &&
            uploadedFileUrls.length === 0
        );

        let status = SubmissionStatus.PENDING_REVIEW;
        let score = null;

        // 10. Auto-grade nếu toàn bộ câu đều tự chấm được
        if (canAutoGrade) {
            const answerByQuestionId = new Map(
                (answers || []).map(
                    answer => [
                        answer.questionId,
                        answer.response
                    ]
                )
            );

            score = questions.reduce(
                (total, question) => {
                    const response =
                        answerByQuestionId.get(
                            question.questionId
                        );

                    return (
                        total +
                        question.grade(response)
                    );
                },
                0
            );

            status = SubmissionStatus.GRADED;
        }

        const submittedAt = now.toISOString();

        // 11. Update Submission
        const { data, error } = await supabase
            .from('Submission')
            .update({
                submittedAt,
                late: isLate,
                status,
                score
            })
            .eq('submissionId', submissionId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // 12. Nếu auto-grade thành công thì cập nhật Analytics
        let analytics = null;

        if (status === SubmissionStatus.GRADED) {
            analytics =
                await AssessmentAnalyticsIntegrationService
                    .recordAssessmentScore({
                        learnerId,
                        courseId: assessmentRow.courseId,
                        assessmentId:
                            assessmentRow.assessmentId,
                        score
                    });
        }

        return {
            submission: this._toSubmission(data),
            analytics
        };
    }

    // UC-10: List Assessments visible to the current Learner
    static async getLearnerAssessments(
        learnerId
    ) {
        /*
        * 1. Find approved Courses
        */
        const {
            data: enrollments,
            error: enrollmentError
        } = await supabase
            .from('Enrollment')
            .select(
                'courseId'
            )
            .eq(
                'learnerId',
                learnerId
            )
            .eq(
                'status',
                EnrollmentStatus.APPROVED
            );

        if (enrollmentError) {
            throw enrollmentError;
        }


        const courseIds = [
            ...new Set(
                (enrollments || []).map(
                    item =>
                        item.courseId
                )
            )
        ];


        if (
            courseIds.length === 0
        ) {
            return [];
        }


        /*
        * 2. Load Assessments
        */
        const {
            data: assessmentRows,
            error: assessmentError
        } = await supabase
            .from('Assessment')
            .select('*')
            .in(
                'courseId',
                courseIds
            )
            .order(
                'startTime',
                {
                    ascending: true
                }
            );

        if (assessmentError) {
            throw assessmentError;
        }


        const assessmentIds =
            (assessmentRows || [])
                .map(
                    row =>
                        row.assessmentId
                );



        const submissionByAssessmentId =
            new Map();


        if (
            assessmentIds.length > 0
        ) {
            const {
                data: submissionRows,
                error: submissionError
            } =
                await supabase
                    .from('Submission')
                    .select('*')
                    .eq(
                        'learnerId',
                        learnerId
                    )
                    .in(
                        'assessmentId',
                        assessmentIds
                    );


            if (submissionError) {
                throw submissionError;
            }


            for (
                const submissionRow of
                submissionRows || []
            ) {
                submissionByAssessmentId.set(
                    String(
                        submissionRow
                            .assessmentId
                    ),
                    submissionRow
                );
            }
        }
        
        const assessments = [];

        for (
            const row of
            assessmentRows || []
        ) {
            const synchronized =
                await this
                    ._synchronizeAssessmentStatus(
                        row
                    );

            const assessment =
                this._toAssessment(
                    synchronized
                );

            /*
            * Learners must not see Educator drafts.
            */
            if (
                assessment.status !==
                AssessmentStatus.DRAFT
            ) {
                const submissionRow =
                    submissionByAssessmentId
                        .get(
                            String(
                                assessment
                                    .assessmentId
                            )
                        ) ||
                    null;


                assessments.push({
                    ...assessment,

                    submission:
                        submissionRow
                            ? {
                                submissionId:
                                    submissionRow
                                        .submissionId,

                                status:
                                    submissionRow
                                        .status,

                                startedAt:
                                    submissionRow
                                        .startedAt,

                                submittedAt:
                                    submissionRow
                                        .submittedAt,

                                late:
                                    Boolean(
                                        submissionRow
                                            .late
                                    ),

                                score:
                                    submissionRow
                                        .score
                            }
                            : null
                });
            }
        }


        return assessments;
    }
    
    // Design-level operation for manually reviewed essay/file submissions.
    static async gradeSubmission(submissionId, educatorId ,score, feedback = null) {
        const { data: submission, error: submissionError } = await supabase
            .from('Submission')
            .select('*')
            .eq('submissionId', submissionId)
            .maybeSingle();

        if (submissionError) throw submissionError;

        if (!submission) {
            throw new AppError(
                404,
                'SUBMISSION_NOT_FOUND',
                'The Submission could not be found.'
            );
        }

        const assessment = await this._findAssessmentById(
            submission.assessmentId
        );

        const synchronized =
            await this
                ._synchronizeAssessmentStatus(
                    assessment
                );


        const currentAssessment =
            this._toAssessment(
                synchronized
            );


        if (
            currentAssessment.type ===
                AssessmentType.ASSIGNMENT &&
            currentAssessment.status !==
                AssessmentStatus.CLOSED
        ) {
            throw new AppError(
                409,
                'ASSESSMENT_STILL_OPEN',
                'This Assignment cannot be graded until its submission period has closed.'
            );
        }
        await this._assertCourseManagedBy(assessment.courseId, educatorId);

        if (submission.status !== SubmissionStatus.PENDING_REVIEW) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_PENDING_REVIEW',
                'Only a Submission pending review can be graded manually.'
            );
        }

        const numericScore = Number(score);
        if (
            !Number.isFinite(numericScore) ||
            numericScore < 0 ||
            numericScore > Number(assessment.totalPoints)
        ) {
            throw new AppError(
                400,
                'INVALID_SUBMISSION_SCORE',
                'The score is outside the valid range.'
            );
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

        const analytics = await AssessmentAnalyticsIntegrationService
            .recordAssessmentScore({
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

    static _validateTotalPoints(value) {
        const isValidType =
            typeof value === 'number' ||
            typeof value === 'string';

        if (
            !isValidType ||
            (typeof value === 'string' && !value.trim())
        ) {
            throw new AppError(
                400,
                'INVALID_TOTAL_POINTS',
                'Assessment total points must be a non-negative number.'
            );
        }

        const numericTotalPoints = Number(value);

        if (
            !Number.isFinite(numericTotalPoints) ||
            numericTotalPoints < 0
        ) {
            throw new AppError(
                400,
                'INVALID_TOTAL_POINTS',
                'Assessment total points must be a non-negative number.'
            );
        }

        return numericTotalPoints;
    }

    static _generateSafeFileName(originalName) {
        const normalizedName =
            String(originalName || '').replace(/\\/g, '/');

        const baseName =
            path.posix.basename(normalizedName);

        const extension =
            path.posix.extname(baseName).toLowerCase();

        const safeExtension =
            /^\.[a-z0-9]{1,10}$/.test(extension)
                ? extension
                : '';

        return `${crypto.randomUUID()}${safeExtension}`;
    }

    static async _insertQuestion(assessmentId, questionInput) {
        const {
            content,
            type,
            points = 0,
            displayOrder = 0,
            options = []
        } = questionInput;

        if (!content || !Object.values(QuestionType).includes(type)) {
            throw new AppError(
                400,
                'INVALID_QUESTION_DATA',
                'Question content and type are required.'
            );
        }

        let optionContents = [];
        let correctAnswer = null;

        if (type === QuestionType.MULTIPLE_CHOICE) {
            const correctOptions =
                options.filter(option => option.isCorrect);

            if (
                options.length < 2 ||
                correctOptions.length !== 1
            ) {
                throw new AppError(
                    400,
                    'INVALID_MULTIPLE_CHOICE_OPTIONS',
                    'A multiple-choice Question requires at least two options and exactly one correct option.'
                );
            }

            optionContents =
                options.map(option => option.content);

            correctAnswer =
                correctOptions[0].content;
        }

        const { data, error } = await supabase
            .from('Question')
            .insert({
                assessmentId,
                content,
                type,
                options: optionContents,
                correctAnswer,
                points: Number(points || 0),
                displayOrder
            })
            .select()
            .single();

        if (error) throw error;

        return new Question(data);
    }
    static async _loadQuestionsWithOptions(
        assessmentId,
        includeCorrect
    ) {
        const { data, error } = await supabase
            .from('Question')
            .select('*')
            .eq('assessmentId', assessmentId)
            .order('displayOrder', {
                ascending: true
            });

        if (error) throw error;

        return (data || []).map(row =>
            new Question({
                questionId: row.questionId,
                assessmentId: row.assessmentId,
                content: row.content,
                type: row.type,
                options: row.options || [],
                correctAnswer:
                    includeCorrect
                        ? row.correctAnswer
                        : null,
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
            throw new AppError(
                404, 
                'ASSESSMENT_NOT_FOUND',
                'The Assessment could not be found.'
            );
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
            throw new AppError(
                404, 
                'COURSE_NOT_FOUND',
                'The Course could not be found.'
            );
        }

        if (data.educatorId !== educatorId) {
            throw new AppError(
                403, 
                'COURSE_ACCESS_DENIED',
                'Only the Educator managing this Course may manage its Assessments.'
            );
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
            throw new AppError(
                403,
                'COURSE_MEMBERSHIP_REQUIRED',
                'You must be an approved member of the Course to access this Assessment.'
            );
        }

        return data;
    }

    static async _assertOwnedSubmission(submissionId, learnerId) {
        const { data, error, } = await supabase 
            .from('Submission')
            .select('*')
            .eq('submissionId', submissionId)
            .eq('learnerId', learnerId)
            .maybeSingle();
        
        if (error) throw error;
        if (!data) {
            throw new AppError(
                404,
                'SUBMISSION_NOT_FOUND',
                'The Submission could not be found.'
            );
        }

        return data;
    }

    static _validateSchedule(startTime, deadline) {
        const start = new Date(startTime); 
        const end = new Date(deadline);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            start >= end
        ) {
            throw new AppError(
                400,
                'INVALID_ASSESSMENT_SCHEDULE',
                'The Assessment deadline must be after the start time.'
            );
        }
    }

    static async _synchronizeAssessmentStatus(assessmentRow) {
        if (
            assessmentRow.status === AssessmentStatus.DRAFT ||
            !assessmentRow.startTime ||
            !assessmentRow.deadline
        ) {
            return assessmentRow; 
        }

        const now = new Date();
        const start = new Date(assessmentRow.startTime);
        const deadline = new Date(assessmentRow.deadline);

        let nextStatus = AssessmentStatus.SCHEDULED; 

        if (now >= start && now <= deadline) {
            nextStatus = AssessmentStatus.IN_PROGRESS;
        }
        else if (now > deadline) {
            nextStatus = AssessmentStatus.CLOSED;
        }

        if (nextStatus === assessmentRow.status) {
            return assessmentRow;
        }
        const { data, error } = await supabase
            .from('Assessment')
            .update({ status: nextStatus })
            .eq('assessmentId', assessmentRow.assessmentId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async _notifyCourseLearners({
        courseId,
        assessmentId,
        action
    }) {
        return NotificationService
            .notifyAssessmentChanged({
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
            instructionFileUrl: row.instructionFileUrl || null,
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
            uploadedFileUrls: Array.isArray(
                row.uploadedFileUrls
            )
                ? row.uploadedFileUrls
                : []
        });
    }
}

module.exports = AssessmentService;