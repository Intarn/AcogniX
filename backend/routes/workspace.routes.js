// backend/routes/workspace.routes.js
const express = require('express');
const multer = require('multer');
const WorkspaceController = require('../controllers/WorkspaceController');
const NoteController = require('../controllers/NoteController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);
router.use(authorize(UserRole.LEARNER));

// Project CRUD
router.get('/', WorkspaceController.getWorkspaceData);
router.post('/projects', WorkspaceController.createProject);
router.patch('/projects/:projectId/rename', WorkspaceController.renameProject);
router.delete('/projects/:projectId', WorkspaceController.deleteProject);
router.put('/projects/:projectId/context', WorkspaceController.updateActiveContext);

// Materials
router.post('/projects/:projectId/materials', upload.single('material'), WorkspaceController.uploadMaterial);
router.delete('/projects/:projectId/materials/:materialId', WorkspaceController.deleteMaterial);

// Notes
router.get('/projects/:projectId/notes', NoteController.getProjectNotes);
router.get('/notes', NoteController.getAllNotes);
router.post('/projects/:projectId/notes', NoteController.createNote);
router.patch('/notes/:noteId', NoteController.updateNote);
router.delete('/notes/:noteId', NoteController.deleteNote);

module.exports = router;