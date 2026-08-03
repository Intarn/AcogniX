/**
 * Integration boundary between Classroom Management and AI Workspace.
 *
 * Replace these placeholder methods when the AI Workspace module is available.
 * Keeping this service separate prevents EnrollmentService from depending on
 * AI Workspace implementation details.
 */
class WorkspaceIntegrationService {
  static async provisionClassProject({ learnerId, courseId, projectName }) {
    if (process.env.ENABLE_WORKSPACE_INTEGRATION !== 'true') {
      return {
        provisioned: false,
        reason: 'AI_WORKSPACE_INTEGRATION_DISABLED'
      };
    }

    // TODO: Call WorkspaceService.provisionClassProject(...)
    throw new Error(
      `Workspace integration is enabled but not implemented for learner ${learnerId}, course ${courseId}, project ${projectName}.`
    );
  }

  static async revokeClassProjectAccess({ learnerId, courseId }) {
    if (process.env.ENABLE_WORKSPACE_INTEGRATION !== 'true') {
      return {
        revoked: false,
        reason: 'AI_WORKSPACE_INTEGRATION_DISABLED'
      };
    }

    // TODO: Call the AI Workspace operation that revokes/deactivates access.
    throw new Error(
      `Workspace integration is enabled but not implemented for learner ${learnerId}, course ${courseId}.`
    );
  }
}

module.exports = WorkspaceIntegrationService;
