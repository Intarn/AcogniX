class SubmissionAnswer {
  constructor({
    answerId,
    submissionId,
    questionId,
    response,
    awardedPoints = null
  }) {
    this.answerId = answerId;
    this.submissionId = submissionId;
    this.questionId = questionId;
    this.response = response;
    this.awardedPoints = awardedPoints;
  }

  updateResponse(response) {
    this.response = response;
  }

  recordPoints(points) {
    this.awardedPoints = Number(points);
  }
}

module.exports = SubmissionAnswer;