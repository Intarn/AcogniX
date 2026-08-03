const supabase = require('../config/supabaseClient'); 

class WorkspaceService {
  // ===================================================================
  // MANAGE AI WORKSPACE (UC-01)
  // ===================================================================
  // +getWorkspace(learnerId: UUID) : AIWorkspace
  static async getWorkspace(learnerId) {
    const { data, error } = await supabase
      .from('AI_Workspace')
      .select('*, AI_Project(*)')
      .eq('learnerId', learnerId)
      .single();
    if (error) throw new Error('WORKSPACE_NOT_FOUND');
    return data;
  }

  // +createPersonalProject(workspaceId: UUID, name: String) : AIProject
  static async createPersonalProject(workspaceId, courseId, name) {
    // Check for duplicate name (Alternative flow 3 - UC-01)
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

  // ===================================================================
  // UPLOAD PERSONAL MATERIALS (UC-01 Alt Flow 2)
  // ===================================================================
  // +uploadPersonalMaterial(projectId: UUID, file: File) : LearningMaterial
  static async uploadPersonalMaterial(projectId, fileBuffer, originalName, mimeType, sizeBytes) {
    // Limit to 50MB (Alternative flow 2 - UC-01)
    if (sizeBytes > 50 * 1024 * 1024) {
      const err = new Error('FILE_TOO_LARGE');
      err.status = 400;
      throw err;
    }

    // 1. Upload file to Supabase Storage
    const filePath = `projects/${projectId}/${Date.now()}_${originalName}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('materials')
      .upload(filePath, fileBuffer, { contentType: mimeType });

    if (storageError) throw storageError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('materials')
      .getPublicUrl(filePath);

    // 2. Save metadata into Learning_Material table
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
}

module.exports = WorkspaceService;