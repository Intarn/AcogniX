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
const e = require('express');

class AssessmentService {
    // UC-09: Create an official quiz or assignment in a managed Course 
    static async createAssessment(courseId, educatorId, assessmentInput) {
        await this._assertCourseManagedBy(courseId, educatorId); 

        const {
            title, 
            description = null, 
            type, 
            totalPoints = 0, 
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
                totalPoints: Number(totalPoints || 0), 
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
            updateData.totalPoints = Number(changes.totalPoints);
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
        const assessmentRow = await this._findAssessmentById(assessmentId);
        await this._assertCourseManagedBy(assessmentRow.courseId, educatorId);

        const synchronized = await this._synchronizeAssessmentStatus(assessmentRow);
        const assessment = this._toAssessment(synchronized);

        if (!assessment.isEditable()) {
            throw new AppError(
                409,
                'ASSESSMENT_NOT_EDITABLE',
                'An active or closed Assessment cannot be deleted.'
            );
        }

        const { data: questions, error: questionError } = await supabase
            .from('Question')
            .select('questionId')
            .eq('assessmentId', assessmentId);

        if (questionError) throw questionError;
        const questionIds = (questions || []).map(item => item.questionId);

        if (questionIds.length > 0) {
            const { error: optionError } = await supabase
                .from('Question_Option')
                .delete()
                .in('questionId', questionIds);

            if (optionError) throw optionError;

            const { error: deleteQuestionError } = await supabase
                .from('Question')
                .delete()
                .eq('assessmentId', assessmentId);

            if (deleteQuestionError) throw deleteQuestionError;
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

        const filePath = `instructions/${assessmentId}/${Date.now()}_${file.originalname}`;

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
            if (existing.status === SubmissionStatus.IN_PROGRESS) {
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

    // UC-10 Basic Flow Step 2: Save on Learner response
    static async saveAnswer(submissionId, learnerId, questionId, response) {
        const submission = await this._assertOwnedSubmission(
            submissionId,
            learnerId
        );

        if (submission.status !== SubmissionStatus.IN_PROGRESS) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_EDITABLE',
                'A submitted Assessment can no longer be changed.'
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

    // UC-10 Basic FLow step 2: Upload asignment files
    static async uploadFiles(submissionId, learnerId, files) {
        // 1. Kiểm tra Submission có thuộc Learner hiện tại không
        const submission = await this._assertOwnedSubmission(
            submissionId,
            learnerId
        );

        // 2. Chỉ được upload khi Submission còn IN_PROGRESS
        if (submission.status !== SubmissionStatus.IN_PROGRESS) {
            throw new AppError(
                409,
                'SUBMISSION_NOT_EDITABLE',
                'A submitted Assessment can no longer be changed.'
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
            const filePath =
                `submissions/${submissionId}/${Date.now()}_${file.originalname}`;

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

    // UC-10 Basic Flow steps 3-5 and Alternative Flow 1
    static async submitSubmission(submissionId, learnerId) {
        // 1. Kiểm tra Submission thuộc Learner hiện tại
        const submissionRow = await this._assertOwnedSubmission(
            submissionId,
            learnerId
        );

        // 2. Submission chỉ được submit một lần
        if (submissionRow.status !== SubmissionStatus.IN_PROGRESS) {
            throw new AppError(
                409,
                'SUBMISSION_ALREADY_FINALIZED',
                'This Assessment has already been submitted.'
            );
        }

        // 3. Lấy Assessment tương ứng
        const assessmentRow = await this._findAssessmentById(
            submissionRow.assessmentId
        );

        const now = new Date();

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
            Number.isNaN(numericScore) ||
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

    static async _notifyCourseLearners({ courseId, assessmentId, action }) {
        const { data, error } = await supabase  
            .from('Enrollment')
            .select('learnerId')
            .eq('courseId', courseId)
            .eq('status', EnrollmentStatus.APPROVED);

        if (error) throw error; 

        const learnerIds = (data || []).map(item => item.learnerId);

        return NotificationService.notifyAssessmentChanged({
            learnerIds, 
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