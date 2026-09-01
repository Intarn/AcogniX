// backend/routes/workspace.routes.js
const express = require('express');
const multer = require('multer');
const WorkspaceController = require('../controllers/WorkspaceController');
const NoteController = require('../controllers/NoteController');
const { requireAuth, authorize } = require('../middleware/authMiddleware');
const { UserRole } = require('../enums/AuthEnums');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const handleMaterialUpload = (req, res, next) => {
  upload.single('material')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds the 50MB size limit.'
      });
    }
    if (error) {
      return res.status(400).json({
        code: 'UPLOAD_ERROR',
        message: error.message || 'Unable to upload the material.'
      });
    }
    return next();
  });
};

router.use(requireAuth);
router.use(authorize(UserRole.LEARNER));

// Project CRUD
router.get('/', WorkspaceController.getWorkspaceData);
router.post('/projects', WorkspaceController.createProject);
router.patch('/projects/:projectId/rename', WorkspaceController.renameProject);
router.delete('/projects/:projectId', WorkspaceController.deleteProject);
router.put('/projects/:projectId/context', WorkspaceController.updateActiveContext);

// Materials
router.post('/projects/:projectId/materials', handleMaterialUpload, WorkspaceController.uploadMaterial);
router.delete('/projects/:projectId/materials/:materialId', WorkspaceController.deleteMaterial);

// Notes
router.get('/projects/:projectId/notes', NoteController.getProjectNotes);
router.get('/notes', NoteController.getAllNotes);
router.post('/projects/:projectId/notes', NoteController.createNote);
router.patch('/notes/:noteId', NoteController.updateNote);
router.delete('/notes/:noteId', NoteController.deleteNote);

module.exports = router;