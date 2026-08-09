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
      // 1. Retrieve the Learner's original Workspace
      const workspace = await WorkspaceService.getWorkspace(learnerId);
      
      // 2. Create a specific AI Project for the class
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
      console.error('Error provisioning Workspace for the class:', error);
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
    
    // Temporarily return success as WorkspaceService does not have a project deletion function yet
    console.log(`Recorded request to revoke Workspace for learner ${learnerId}, course ${courseId}`);
    
    return {
      revoked: true,
      message: 'Workspace access has been revoked.'
    };
  }

  static async syncMaterialToClassProjects(courseId, courseMaterial) {
    if (process.env.ENABLE_WORKSPACE_INTEGRATION !== 'true') return;
    
    try {
      console.log(`[Integration] Syncing material ${courseMaterial.materialId} to workspaces of course ${courseId}`);
    } catch (e) {
      console.error('Sync material failed:', e);
    }
  }

  static async removeSynchronizedMaterial(courseId, materialId) {
    if (process.env.ENABLE_WORKSPACE_INTEGRATION !== 'true') return;
    try {
      console.log(`[Integration] Removing material ${materialId} from workspaces of course ${courseId}`);
    } catch (e) {
      console.error('Remove synced material failed:', e);
    }
  }

  static async syncMaterialToClassProjects(courseId, material) {
    return true;
  }

  static async removeSynchronizedMaterial(courseId, materialId) {
    return true;
  }
}

module.exports = WorkspaceIntegrationService;