import {
  apiRequest
} from '../../services/apiClient';


// ========================================
// UC-25: MANAGE PERSONAL NOTES
// ========================================


// Get all Personal Notes
// belonging to one AI Project
export function getProjectNotes(
  projectId
) {
  return apiRequest(
    `/workspace/projects/${projectId}/notes`
  );
}


// Create a new Personal Note
// inside one AI Project
export function createNote(
  projectId,
  noteData
) {
  return apiRequest(
    `/workspace/projects/${projectId}/notes`,
    {
      method: 'POST',

      body: JSON.stringify({
        title:
          noteData.title,

        content:
          noteData.content
      })
    }
  );
}


// Update an existing Personal Note
export function updateNote(
  noteId,
  noteData
) {
  return apiRequest(
    `/workspace/notes/${noteId}`,
    {
      method: 'PATCH',

      body: JSON.stringify({
        title:
          noteData.title,

        content:
          noteData.content
      })
    }
  );
}


// Delete an existing Personal Note
export function deleteNote(
  noteId
) {
  return apiRequest(
    `/workspace/notes/${noteId}`,
    {
      method: 'DELETE'
    }
  );
}