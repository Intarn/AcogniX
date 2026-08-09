const {
  SubmissionStatus
} = require('../enums/AssessmentEnums');

class Submission {
    constructor({
        submissionId,
        assessmentId,
        learnerId,
        status = SubmissionStatus.IN_PROGRESS,
        startedAt = new Date(),
        submittedAt = null,
        late = false,
        score = null,
        feedback = null,
        uploadedFileUrls = []
    }) {
        this.submissionId = submissionId;
        this.assessmentId = assessmentId;
        this.learnerId = learnerId;
        this.status = status;
        this.startedAt = startedAt;
        this.submittedAt = submittedAt;
        this.late = Boolean(late);
        this.score = score;
        this.feedback = feedback;
        this.uploadedFileUrls = uploadedFileUrls;
    }

    addFile(fileUrl) {
        this.uploadedFileUrls.push(fileUrl);
    }

    submit(submittedAt = new Date()) {
        this.submittedAt = submittedAt;
        this.status =
        SubmissionStatus.SUBMITTED;
    }

    markLate() {
        this.late = true;
    }

    markPendingReview() {
        this.status =
        SubmissionStatus.PENDING_REVIEW;
    }

    recordScore(score, feedback = null) {
        this.score = Number(score);
        this.feedback = feedback;
        this.status =
        SubmissionStatus.GRADED;
    }
}

module.exports = Submission;