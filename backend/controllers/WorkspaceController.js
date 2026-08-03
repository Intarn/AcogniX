const WorkspaceService = require('../service/WorkspaceService');

class WorkspaceController {
  static async getWorkspaceData(req, res) {
    try {
      // req.user lấy từ authMiddleware
      const learnerId = req.user.userId; 
      const workspace = await WorkspaceService.getWorkspace(learnerId);
      return res.status(200).json(workspace);
    } catch (error) {
      return res.status(404).json({ message: "Không tìm thấy Workspace." });
    }
  }

  static async createProject(req, res) {
    try {
      const { workspaceId, courseId, name } = req.body;
      if (!name) return res.status(400).json({ message: "Tên dự án không được để trống." });
      
      const newProject = await WorkspaceService.createPersonalProject(workspaceId, courseId, name);
      return res.status(201).json({ message: "Tạo dự án thành công.", project: newProject });
    } catch (error) {
      if (error.message === 'PROJECT_NAME_EXISTS') {
        return res.status(409).json({ message: "Tên dự án đã tồn tại. Vui lòng chọn tên khác." });
      }
      return res.status(500).json({ message: "Lỗi server khi tạo dự án." });
    }
  }

  static async uploadMaterial(req, res) {
    try {
      const { projectId } = req.params;
      const file = req.file; // Lấy từ multer
      
      if (!file) return res.status(400).json({ message: "Vui lòng chọn file để upload." });

      const material = await WorkspaceService.uploadPersonalMaterial(
        projectId, 
        file.buffer, 
        file.originalname, 
        file.mimetype, 
        file.size
      );
      return res.status(201).json({ message: "Upload thành công.", material });
    } catch (error) {
      if (error.message === 'FILE_TOO_LARGE') {
        return res.status(400).json({ message: "File vượt quá giới hạn 50MB." });
      }
      return res.status(500).json({ message: "Lỗi server khi upload file." });
    }
  }
}

module.exports = WorkspaceController;