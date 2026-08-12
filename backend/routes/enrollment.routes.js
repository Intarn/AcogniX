const express = require('express');
const multer = require('multer');
const WorkspaceController = require('../controllers/WorkspaceController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const NoteController = require('../controllers/NoteController');
const { UserRole } = require('../enums/AuthEnums');
const router = express.Router();

// Use multer to store file in RAM (buffer) before uploading to Supabase
const upload = multer({ storage: multer.memoryStorage() });

// Routes requiring authentication
router.use(requireAuth);

router.get('/', WorkspaceController.getWorkspaceData);
router.post('/projects', WorkspaceController.createProject);

// Route to handle file upload (expects field named 'material')
router.post('/projects/:projectId/materials', upload.single('material'), WorkspaceController.uploadMaterial);

// UC-25: Get all Personal Notes in an AI Project
router.get(
  '/projects/:projectId/notes',
  authorize(UserRole.LEARNER),
  NoteController.getProjectNotes
);

router.get(
    '/notes',
    requireAuth,
    authorize(
        UserRole.LEARNER
    ),
    NoteController.getAllNotes
);

// UC-25: Save a new Personal Note
router.post(
  '/projects/:projectId/notes',
  authorize(UserRole.LEARNER),
  NoteController.createNote
);

// UC-25: Update an existing Personal Note
router.patch(
  '/notes/:noteId',
  authorize(UserRole.LEARNER),
  NoteController.updateNote
);

// UC-25: Delete a Personal Note
router.delete(
  '/notes/:noteId',
  authorize(UserRole.LEARNER),
  NoteController.deleteNote
);

module.exports = router;