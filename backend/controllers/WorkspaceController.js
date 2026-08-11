const WorkspaceService = require('../service/WorkspaceService');
const AIServiceClient = require('../service/AIServiceClient');

class WorkspaceController {
  static async getWorkspaceData(req, res) {
    try {
      const learnerId = req.user.userId; 
      const workspace = await WorkspaceService.getWorkspace(learnerId);
      return res.status(200).json(workspace);
    } catch (error) {
      return res.status(404).json({ message: "Workspace not found." });
    }
  }

  static async createProject(req, res) {
    try {
      const { workspaceId, courseId, name } = req.body;
      
      // Basic Flow (UC-01)
      if (!name) {
        return res.status(400).json({ message: "Project name cannot be empty." }); 
      }
      
      const newProject = await WorkspaceService.createPersonalProject(workspaceId, courseId, name);
      return res.status(201).json({ message: "Project created successfully.", project: newProject });
    } catch (error) {
      if (error.message === 'PROJECT_NAME_EXISTS') {
        return res.status(409).json({ message: "Project name already exists. Please choose another name." }); // Alternative flow 3 (UC-01)
      }
      return res.status(500).json({ message: "Server error while creating project." });
    }
  }

  static async uploadMaterial(req, res) {
    try {
      const { projectId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "Please select a file to upload." });
      }

      // 1. Lưu file vào Supabase (Hoạt động tốt)
      const material = await WorkspaceService.uploadPersonalMaterial(
        projectId,
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size
      );

      // 2. Chuyển cho Server Python (AI) đọc và trích xuất ngữ cảnh
      try {
        const materialId = material.materialId || material.id;
        await AIServiceClient.extractDocument(
          materialId,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        console.log(`[AI] Đã trích xuất và nạp ngữ cảnh thành công cho file: ${file.originalname}`);
      } catch (aiErr) {
        console.error("[Lỗi kết nối AI Server]:", aiErr.message);
        
        // QUAN TRỌNG: Ném thẳng lỗi ra Frontend thay vì trả về 201 Thành công
        return res.status(502).json({ 
          message: "Tài liệu đã được lưu, nhưng Server AI xử lý thất bại. Lỗi: " + aiErr.message 
        });
      }

      return res.status(201).json({ message: "Upload và AI nạp ngữ cảnh thành công!", material });
    } catch (error) {
      console.error("Lỗi chi tiết khi upload file:", error);
      if (error.message === 'FILE_TOO_LARGE') {
        return res.status(400).json({ message: "File size exceeds the 50MB limit." });
      }
      return res.status(500).json({ message: "Server error while uploading file." });
    }
  }

  static async deleteMaterial(req, res) {
    try {
      const { projectId, materialId } = req.params;
      await WorkspaceService.deletePersonalMaterial(projectId, materialId);
      return res.status(200).json({ message: "Đã xóa tài liệu thành công." });
    } catch (error) {
      console.error("Lỗi khi xóa tài liệu:", error);
      return res.status(500).json({ message: "Lỗi server khi xóa tài liệu." });
    }
  }
}

module.exports = WorkspaceController;