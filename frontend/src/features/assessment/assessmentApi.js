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


export async function getAssessmentInstructionFileBlob(
  assessmentId,
  { download = false } = {}
) {
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api';
  const token =
    localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/assessments/${encodeURIComponent(assessmentId)}/instruction-file${download ? '?download=1' : ''}`,
    {
      method: 'GET',
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {}
    }
  );

  if (!response.ok) {
    const data =
      await response
        .json()
        .catch(() => null);

    const error = new Error(
      data?.message ||
      'Assessment instruction file is unavailable.'
    );

    error.status = response.status;
    error.code = data?.code;
    throw error;
  }

  return {
    blob: await response.blob(),
    contentType:
      response.headers.get('content-type') ||
      'application/octet-stream',
    contentDisposition:
      response.headers.get('content-disposition') ||
      ''
  };
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