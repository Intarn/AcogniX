const { QuestionType } = require('../enums/AssessmentEnums');

class Question {
    constructor({
        questionId, 
        assessmentId, 
        content, 
        type, 
        options = [], 
        correctAnswer = null, 
        points = 0, 
        displayOrder = null
    }) {
        this.questionId = questionId; 
        this.assessmentId = assessmentId; 
        this.content = content; 
        this.type = type; 
        this.options = options; 
        this.correctAnswer = correctAnswer; 
        this.points = Number(points || 0);
        this.displayOrder = displayOrder;
    }

    updateContent(content, points) {
        this.content = content; 
        this.points = Number(points || 0); 
    }

    isAutoGradable() {
        return (
            this.type === QuestionType.MULTIPLE_CHOICE
        ); 
    }

    grade(response) {
        if (!this.isAutoGradable()) {
            return null;
        }

        return (
            String(response) === String(this.correctAnswer)
        )
        ? this.points : 0; 
    }
}

module.exports = Question; 