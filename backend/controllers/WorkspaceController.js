const WorkspaceService = require('../service/WorkspaceService');

class WorkspaceController {
  static async getWorkspaceData(req, res) {
    try {
      // req.user is extracted from authMiddleware
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
      if (!name) return res.status(400).json({ message: "Project name cannot be empty." });
      
      const newProject = await WorkspaceService.createPersonalProject(workspaceId, courseId, name);
      return res.status(201).json({ message: "Project created successfully.", project: newProject });
    } catch (error) {
      if (error.message === 'PROJECT_NAME_EXISTS') {
        return res.status(409).json({ message: "Project name already exists. Please choose another name." });
      }
      return res.status(500).json({ message: "Server error while creating project." });
    }
  }

  static async uploadMaterial(req, res) {
    try {
      const { projectId } = req.params;
      const file = req.file; // Extracted by multer
      
      if (!file) return res.status(400).json({ message: "Please select a file to upload." });

      const material = await WorkspaceService.uploadPersonalMaterial(
        projectId, 
        file.buffer, 
        file.originalname, 
        file.mimetype, 
        file.size
      );
      return res.status(201).json({ message: "Upload successful.", material });
    } catch (error) {
      if (error.message === 'FILE_TOO_LARGE') {
        return res.status(400).json({ message: "File size exceeds the 50MB limit." });
      }
      return res.status(500).json({ message: "Server error while uploading file." });
    }
  }
}

module.exports = WorkspaceController;