// backend/entities/Assessment.js
const { AssessmentStatus } = require('../enums/AssessmentEnums');

class Assessment {
    constructor({
        assessmentId, 
        courseId, 
        title,
        description = null,
        type, 
        instructionFileUrl = null, 
        instructionFileName = null,
        startTime = null, 
        deadline = null, 
        totalPoints = 0, 
        allowLateSubmission = false, 
        status = AssessmentStatus.DRAFT, 
        createdAt = new Date()
    }) {
        this.assessmentId = assessmentId; 
        this.courseId = courseId;
        this.title = title;
        this.description = description;
        this.type = type;
        this.instructionFileUrl = instructionFileUrl; 
        this.instructionFileName = instructionFileName;
        this.startTime = startTime ? new Date(startTime) : null; 
        this.deadline = deadline ? new Date(deadline) : null;
        this.totalPoints = Number(totalPoints || 0);
        this.allowLateSubmission = Boolean(allowLateSubmission);
        this.status = status; 
        this.createdAt = createdAt;
    }

    updateDetails(title, description) {
        this.title = title; 
        this.description = description; 
    }

    configureSchedule(startTime, deadline) {
        this.startTime = new Date(startTime);
        this.deadline = new Date(deadline);
    }

    publish(currentTime = new Date()) {
        if (!this.startTime || !this.deadline) {
            throw new Error('ASSESSMENT_SCHEDULE_REQUIRED');
        }
        if (currentTime < this.startTime) {
            this.status = AssessmentStatus.SCHEDULED;
        }
        else if (currentTime <= this.deadline) {
            this.status = AssessmentStatus.IN_PROGRESS;
        }
        else {
            this.status = AssessmentStatus.CLOSED;
        }
    }

    close() {
        this.status = AssessmentStatus.CLOSED;
    }

    isOpen(currentTime = new Date()) {
        if (!this.startTime || !this.deadline) {
            return false; 
        }
        return (
            this.status !== AssessmentStatus.DRAFT &&
            currentTime >= this.startTime &&
            currentTime <= this.deadline
        );
    }

    canAcceptSubmission(currentTime = new Date()) {
        if (!this.startTime || !this.deadline) {
            return false;
        }
        if (this.status === AssessmentStatus.DRAFT) {
            return false;
        }
        if (currentTime < this.startTime) {
            return false;
        }
        if (currentTime <= this.deadline) {
            return true;
        }
        return this.allowLateSubmission;
    }

    isEditable(currentTime = new Date()) {
        if (
            this.status === AssessmentStatus.IN_PROGRESS ||
            this.status === AssessmentStatus.CLOSED
        ) {
            return false; 
        }
        if (
            this.status !== AssessmentStatus.DRAFT &&
            this.startTime && 
            currentTime >= this.startTime
        ) {
            return false; 
        }
        // Bản nháp (DRAFT) luôn được phép chỉnh sửa và upload tệp
        return true; 
    }
}

module.exports = Assessment;