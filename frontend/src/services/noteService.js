// import {
//   apiRequest
// } from '../../services/apiClient';


// // UC-25: Get Personal Notes
// // belonging to one AI Project
// export function getProjectNotes(
//   projectId
// ) {
//   return apiRequest(
//     `/workspace/projects/${projectId}/notes`
//   );
// }


// // UC-25: Create Personal Note
// export function createNote(
//   projectId,
//   noteData
// ) {
//   return apiRequest(
//     `/workspace/projects/${projectId}/notes`,
//     {
//       method: 'POST',

//       body: JSON.stringify({
//         title:
//           noteData.title,

//         content:
//           noteData.content
//       })
//     }
//   );
// }


// // UC-25: Update Personal Note
// export function updateNote(
//   noteId,
//   noteData
// ) {
//   return apiRequest(
//     `/workspace/notes/${noteId}`,
//     {
//       method: 'PATCH',

//       body: JSON.stringify({
//         title:
//           noteData.title,

//         content:
//           noteData.content
//       })
//     }
//   );
// }


// // UC-25: Delete Personal Note
// export function deleteNote(
//   noteId
// ) {
//   return apiRequest(
//     `/workspace/notes/${noteId}`,
//     {
//       method: 'DELETE'
//     }
//   );
// }