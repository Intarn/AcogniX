// backend/controllers/WorkspaceController.js
const WorkspaceService = require('../service/WorkspaceService');
const AppError = require('../error/AppError');

class WorkspaceController {
  static async getWorkspaceData(req, res) {
    try {
      const learnerId = req.user.userId;
      const workspace = await WorkspaceService.getWorkspace(learnerId);
      return res.status(200).json(workspace);
    } catch (error) {
      console.error('[WorkspaceController] getWorkspaceData error:', error);
      return res.status(error.statusCode || 500).json({
        code: error.code || 'DB_ERROR',
        message: error.message || 'Không thể tải dữ liệu Workspace.'
      });
    }
  }

  static async createProject(req, res) {
    try {
      const { name } = req.body;
      const learnerId = req.user.userId;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ code: 'INVALID_NAME', message: 'Tên project không được để trống.' });
      }

      // Never trust a client-supplied workspaceId/courseId for Personal Projects.
      // The service resolves the authenticated Learner's Workspace server-side.
      const project = await WorkspaceService.createPersonalProject(learnerId, name.trim());
      return res.status(201).json({ message: 'Tạo project thành công.', project });
    } catch (error) {
      if (error.statusCode === 409 || error.code === 'PROJECT_NAME_EXISTS') {
        return res.status(409).json({ code: 'PROJECT_NAME_EXISTS', message: 'Project name already exists. Please choose another name.' });
      }
      return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi tạo project.' });
    }
  }

  static async renameProject(req, res) {
    try {
      const { projectId } = req.params;
      const { name } = req.body;
      const learnerId = req.user.userId;
      const updated = await WorkspaceService.renameProject(projectId, learnerId, name);
      return res.status(200).json({ message: 'Đổi tên project thành công.', project: updated });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ code: error.code || 'ERROR', message: error.message });
    }
  }

  static async deleteProject(req, res) {
    try {
      const { projectId } = req.params;
      const learnerId = req.user.userId;
      await WorkspaceService.deletePersonalProject(projectId, learnerId);
      return res.status(200).json({ message: 'Đã xóa project thành công.' });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ code: error.code || 'ERROR', message: error.message });
    }
  }

  static async uploadMaterial(req, res) {
    try {
      const { projectId } = req.params;
      const file = req.file;
      const learnerId = req.user.userId;
      if (!file) {
        return res.status(400).json({ code: 'NO_FILE', message: 'Vui lòng chọn file tải lên.' });
      }
      const material = await WorkspaceService.uploadPersonalMaterial(
        projectId,
        learnerId,
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size
      );
      return res.status(201).json({ message: 'Tải tài liệu lên thành công.', material });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ code: error.code || 'ERROR', message: error.message });
    }
  }

  static async deleteMaterial(req, res) {
    try {
      const { projectId, materialId } = req.params;
      await WorkspaceService.deletePersonalMaterial(projectId, materialId, req.user.userId);
      return res.status(200).json({ message: 'Đã xóa tài liệu.' });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ code: error.code || 'ERROR', message: error.message });
    }
  }
  static async updateActiveContext(req, res) {
    try {
      const { projectId } = req.params;
      const { selectedMaterialIds } = req.body;
      const learnerId = req.user.userId;

      const result = await WorkspaceService.updateProjectActiveContext(
        projectId,
        learnerId,
        selectedMaterialIds
      );
      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ code: error.code || 'DB_ERROR', message: error.message });
    }
  }
}

module.exports = WorkspaceController;