import {
  apiRequest
} from '../../services/apiClient';


// ==============================
// EDUCATOR - ASSESSMENTS
// ==============================

export function getManagedAssessments(
  courseId
) {
  return apiRequest(
    `/assessments/courses/${courseId}`
  );
}


export function getAssessmentById(
  assessmentId
) {
  return apiRequest(
    `/assessments/${assessmentId}`
  );
}


export function createAssessment(
  courseId,
  assessmentData
) {
  return apiRequest(
    `/assessments/courses/${courseId}`,
    {
      method: 'POST',
      body: JSON.stringify(
        assessmentData
      )
    }
  );
}


export function updateAssessment(
  assessmentId,
  changes
) {
  return apiRequest(
    `/assessments/${assessmentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(
        changes
      )
    }
  );
}


export function deleteAssessment(
  assessmentId
) {
  return apiRequest(
    `/assessments/${assessmentId}`,
    {
      method: 'DELETE'
    }
  );
}


// ==============================
// QUESTIONS
// ==============================

export function getAssessmentQuestions(
  assessmentId
) {
  return apiRequest(
    `/assessments/${assessmentId}/questions`
  );
}


export function addAssessmentQuestion(
  assessmentId,
  questionData
) {
  return apiRequest(
    `/assessments/${assessmentId}/questions`,
    {
      method: 'POST',
      body: JSON.stringify(
        questionData
      )
    }
  );
}


export function updateAssessmentQuestion(
  assessmentId,
  questionId,
  questionData
) {
  return apiRequest(
    `/assessments/${assessmentId}/questions/${questionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(
        questionData
      )
    }
  );
}


export function deleteAssessmentQuestion(
  assessmentId,
  questionId
) {
  return apiRequest(
    `/assessments/${assessmentId}/questions/${questionId}`,
    {
      method: 'DELETE'
    }
  );
}


// ==============================
// SCHEDULE / PUBLISH
// ==============================

export function scheduleAssessment(
  assessmentId,
  startTime,
  deadline
) {
  return apiRequest(
    `/assessments/${assessmentId}/schedule`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        startTime,
        deadline
      })
    }
  );
}


export function publishAssessment(
  assessmentId
) {
  return apiRequest(
    `/assessments/${assessmentId}/publish`,
    {
      method: 'POST'
    }
  );
}


export function uploadInstructionFile(
  assessmentId,
  file
) {
  const formData =
    new FormData();


  formData.append(
    'instructionFile',
    file
  );


  return apiRequest(
    `/assessments/${assessmentId}/instruction-file`,
    {
      method: 'POST',
      body: formData
    }
  );
}


// ==============================
// SUBMISSIONS / GRADING
// ==============================

export function getAssessmentSubmissions(
  assessmentId
) {
  return apiRequest(
    `/assessments/${assessmentId}/submissions`
  );
}


export function getSubmissionById(
  submissionId
) {
  return apiRequest(
    `/assessments/submissions/${submissionId}`
  );
}


export function gradeSubmission(
  submissionId,
  score,
  feedback
) {
  return apiRequest(
    `/assessments/submissions/${submissionId}/grade`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        score,
        feedback
      })
    }
  );
}


// ==============================
// GRADEBOOK
// ==============================

export function getCourseGradebook(
  courseId
) {
  return apiRequest(
    `/assessments/courses/${courseId}/gradebook`
  );
}