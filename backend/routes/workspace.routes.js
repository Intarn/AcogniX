const express = require('express');
const multer = require('multer');
const WorkspaceController = require('../controllers/WorkspaceController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Sử dụng multer lưu file vào RAM (buffer) trước khi đẩy lên Supabase
const upload = multer({ storage: multer.memoryStorage() });

// Routes cần đăng nhập
router.use(requireAuth);

router.get('/', WorkspaceController.getWorkspaceData);
router.post('/projects', WorkspaceController.createProject);

// Route xử lý upload file (nhận field tên là 'material')
router.post('/projects/:projectId/materials', upload.single('material'), WorkspaceController.uploadMaterial);

module.exports = router;