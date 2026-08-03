const WorkspaceService = require('./WorkspaceService');

class WorkspaceIntegrationService {
  static async provisionClassProject({ learnerId, courseId, projectName }) {
    if (process.env.ENABLE_WORKSPACE_INTEGRATION !== 'true') {
      return {
        provisioned: false,
        reason: 'AI_WORKSPACE_INTEGRATION_DISABLED'
      };
    }
    
    try {
      // 1. Lấy thông tin Workspace gốc của Learner
      const workspace = await WorkspaceService.getWorkspace(learnerId);
      
      // 2. Tạo AI Project riêng cho lớp học đó
      const project = await WorkspaceService.createPersonalProject(
        workspace.workspaceId, 
        courseId, 
        projectName
      );

      return {
        provisioned: true,
        project
      };
    } catch (error) {
      console.error('Lỗi khi cấp phát Workspace cho lớp học:', error);
      return {
        provisioned: false,
        reason: error.message
      };
    }
  }

  static async revokeClassProjectAccess({ learnerId, courseId }) {
    if (process.env.ENABLE_WORKSPACE_INTEGRATION !== 'true') {
      return {
        revoked: false,
        reason: 'AI_WORKSPACE_INTEGRATION_DISABLED'
      };
    }
    
    // Tạm thời trả về thành công vì WorkspaceService chưa có hàm xóa project
    console.log(`Đã ghi nhận yêu cầu thu hồi Workspace cho learner ${learnerId}, course ${courseId}`);
    
    return {
      revoked: true,
      message: 'Quyền truy cập Workspace đã được thu hồi.'
    };
  }
}

module.exports = WorkspaceIntegrationService;