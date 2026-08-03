const express = require('express');
const multer = require('multer');
const WorkspaceController = require('../controllers/WorkspaceController');
const { requireAuth } = require('../middleware/authMiddleware'); 
const router = express.Router();

// Use multer to store file in RAM (buffer) before uploading to Supabase
const upload = multer({ storage: multer.memoryStorage() });

// Routes requiring authentication
router.use(requireAuth);

router.get('/', WorkspaceController.getWorkspaceData);
router.post('/projects', WorkspaceController.createProject);

// Route to handle file upload (expects field named 'material')
router.post('/projects/:projectId/materials', upload.single('material'), WorkspaceController.uploadMaterial);

module.exports = router;