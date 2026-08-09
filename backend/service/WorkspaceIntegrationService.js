const WorkspaceService = require('./WorkspaceService');

class WorkspaceIntegrationService {
  static async provisionClassProject({
    learnerId,
    courseId,
    projectName
  }) {
    const project =
      await WorkspaceService.provisionClassProject(
        learnerId,
        courseId,
        projectName
      );

    return {
      provisioned: true,
      project
    };
  }

  static async revokeClassProjectAccess({
    learnerId,
    courseId
  }) {
    const project =
      await WorkspaceService.revokeClassProjectAccess(
        learnerId,
        courseId
      );

    return {
      revoked: true,
      project
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
}

module.exports = WorkspaceIntegrationService;