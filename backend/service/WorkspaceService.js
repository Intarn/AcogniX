const supabase = require('../config/supabaseClient'); 

class WorkspaceService {
  
  // Basic Flow (UC-01): Manage AI Workspace
  static async getWorkspace(learnerId) {
    const { data, error } = await supabase
      .from('AI_Workspace')
      .select('*, AI_Project(*)')
      .eq('learnerId', learnerId)
      .single();
    if (error) throw new Error('WORKSPACE_NOT_FOUND');
    return data;
  }

  static async createPersonalProject(workspaceId, courseId, name) {
    // Alternative flow 3 (UC-01): Check duplicate project name
    const { data: existing } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('workspaceId', workspaceId)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      const err = new Error('PROJECT_NAME_EXISTS');
      err.status = 409;
      throw err;
    }

    // Basic Flow (UC-01): Insert new project
    const { data, error } = await supabase.from('AI_Project').insert([{
      workspaceId,
      courseId, // null if it is a personal project not belonging to a course
      name,
      type: 'PERSONAL',
      status: 'ACTIVE'
    }]).select().single();

    if (error) throw error;
    return data;
  }

  static async provisionClassProject(learnerId, courseId, name) {
    // Find the Learner's Workspace
    const workspace = await this.getWorkspace(learnerId);

    // Check whether the Class Project for this Course already exists
    const { data: existingProject, error: findError } = await supabase
      .from('AI_Project')
      .select('*')
      .eq('workspaceId', workspace.workspaceId)
      .eq('courseId', courseId)
      .eq('type', 'CLASS')
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    // Avoid creating the same Class Project more than once
    if (existingProject) {
      if (existingProject.status === 'ACTIVE') {
        return existingProject;
      }

      const { data: reactivatedProject, error: reactivateError } =
        await supabase
          .from('AI_Project')
          .update({
            status: 'ACTIVE'
          })
          .eq('projectId', existingProject.projectId)
          .select()
          .single();

      if (reactivateError) {
        throw reactivateError;
      }

      return reactivatedProject;
    }

    // Create the Class Project
    const { data, error } = await supabase
      .from('AI_Project')
      .insert([{
        workspaceId: workspace.workspaceId,
        courseId,
        name,
        type: 'CLASS',
        status: 'ACTIVE'
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Alternative flow 2 (UC-01): Upload personal materials
  static async uploadPersonalMaterial(projectId, fileBuffer, originalName, mimeType, sizeBytes) {
    // Alternative flow 2 (UC-01): Limit file size to 50MB
    if (sizeBytes > 50 * 1024 * 1024) {
      const err = new Error('FILE_TOO_LARGE');
      err.status = 400;
      throw err;
    }

    // Alternative flow 2 (UC-01): Upload file to Supabase Storage
    const filePath = `projects/${projectId}/${Date.now()}_${originalName}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('materials')
      .upload(filePath, fileBuffer, { contentType: mimeType });

    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from('materials')
      .getPublicUrl(filePath);

    // Alternative flow 2 (UC-01): Save metadata into Learning_Material table
    const { data: insertedData, error: dbError } = await supabase.from('Learning_Material').insert([{
      projectId,
      title: originalName,
      sourceUrl: urlData.publicUrl, 
      sourceType: 'PERSONAL',
      fileType: mimeType,
      sizeBytes: sizeBytes,
      selectedAsContext: false
    }]).select().single();

    if (dbError) throw dbError;
    return insertedData;
  }

  static async revokeClassProjectAccess(
    learnerId,
    courseId
  ) {
    // Find the Learner's Workspace
    const workspace = await this.getWorkspace(learnerId);

    // Find the Class Project corresponding to the Course
    const { data: project, error: findError } = await supabase
      .from('AI_Project')
      .select('*')
      .eq('workspaceId', workspace.workspaceId)
      .eq('courseId', courseId)
      .eq('type', 'CLASS')
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (!project) {
      const err = new Error('CLASS_PROJECT_NOT_FOUND');
      err.status = 404;
      throw err;
    }

    // Revoke access without deleting the Project
    const { data, error } = await supabase
      .from('AI_Project')
      .update({
        status: 'INACTIVE'
      })
      .eq('projectId', project.projectId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

module.exports = WorkspaceService;