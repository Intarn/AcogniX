// backend/service/WorkspaceService.js
const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class WorkspaceService {
  /**
   * Shared guard for every action that MUTATES/uses AI inside a Project.
   * Archived Class Projects remain readable as learning history, but are read-only:
   * no AI chat, quiz/flashcard generation, uploads, deletes or context changes.
   *
   * materialIds, when supplied, must belong to this exact Project. This prevents
   * a stale selection from the previously opened Project from leaking into AI calls.
   */
  static async assertProjectWritable(projectId, learnerId, materialIds = null) {
    const { data: project, error: projectError } = await supabase
      .from('AI_Project')
      .select('projectId, workspaceId, courseId, type, status, name')
      .eq('projectId', projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'The AI Project could not be found.');
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('AI_Workspace')
      .select('workspaceId, learnerId')
      .eq('workspaceId', project.workspaceId)
      .maybeSingle();

    if (workspaceError) throw workspaceError;
    if (!workspace || workspace.learnerId !== learnerId) {
      throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You do not have permission to access this project.');
    }

    if (project.status === 'INACTIVE') {
      throw new AppError(403, 'PROJECT_ACCESS_REVOKED', 'Access to this Class Project has been revoked.');
    }

    let courseStatus = null;
    if (project.type === 'CLASS' && project.courseId) {
      const { data: course, error: courseError } = await supabase
        .from('Course')
        .select('status')
        .eq('courseId', project.courseId)
        .maybeSingle();

      if (courseError) throw courseError;
      courseStatus = course?.status || null;
    }

    if (project.status === 'ARCHIVED' || courseStatus === 'ARCHIVED') {
      // Self-heal stale AI_Project status if the Course was archived first.
      if (project.status !== 'ARCHIVED') {
        await supabase
          .from('AI_Project')
          .update({ status: 'ARCHIVED' })
          .eq('projectId', project.projectId);
      }

      throw new AppError(
        403,
        'CLASS_PROJECT_ARCHIVED',
        'This Class Project is archived. You can view its learning history, but AI features are disabled.'
      );
    }

    if (Array.isArray(materialIds)) {
      const requestedIds = [...new Set(materialIds.map(String).filter(Boolean))];
      if (requestedIds.length > 0) {
        const { data: ownedMaterials, error: materialError } = await supabase
          .from('Learning_Material')
          .select('materialId')
          .eq('projectId', projectId)
          .in('materialId', requestedIds);

        if (materialError) throw materialError;
        const ownedIds = new Set((ownedMaterials || []).map((item) => String(item.materialId)));
        const invalidIds = requestedIds.filter((id) => !ownedIds.has(id));

        if (invalidIds.length > 0) {
          throw new AppError(
            400,
            'MATERIAL_NOT_IN_PROJECT',
            'One or more selected Learning Materials do not belong to the active Project.'
          );
        }
      }
    }

    return { ...project, courseStatus };
  }
  /**
   * UC-01: Lấy Workspace của Learner & Đồng bộ hóa tự động (Self-healing Auto-Sync)
   */
  static async getWorkspace(learnerId) {
    // 1. Lấy hoặc khởi tạo AI_Workspace cho Learner
    let { data: workspace, error: wsError } = await supabase
      .from('AI_Workspace')
      .select('*')
      .eq('learnerId', learnerId)
      .maybeSingle();

    if (wsError) {
      console.error('[WorkspaceService] Error fetching AI_Workspace:', wsError);
      throw new AppError(500, 'DB_ERROR', 'Không thể lấy thông tin AI Workspace.');
    }

    if (!workspace) {
      const { data: newWs, error: createWsError } = await supabase
        .from('AI_Workspace')
        .insert([{ learnerId }])
        .select()
        .single();

      if (createWsError) {
        console.error('[WorkspaceService] Error creating AI_Workspace:', createWsError);
        throw new AppError(500, 'DB_ERROR', 'Không thể tạo AI Workspace.');
      }
      workspace = newWs;
    }

    // 2. Lấy danh sách lớp APPROVED của Learner
    const { data: enrollments, error: enrollError } = await supabase
      .from('Enrollment')
      .select('courseId')
      .eq('learnerId', learnerId)
      .eq('status', 'APPROVED');

    if (enrollError) {
      console.error('[WorkspaceService] Error fetching Enrollments:', enrollError);
    }

    let enrolledCourses = [];
    const courseIds = (enrollments || []).map((e) => e.courseId).filter(Boolean);
    if (courseIds.length > 0) {
      const { data: courses, error: courseError } = await supabase
        .from('Course')
        .select('courseId, subjectName, courseCode, status')
        .in('courseId', courseIds);
      if (!courseError && courses) {
        enrolledCourses = courses;
      }
    }

    // 3. Lấy danh sách AI_Project hiện có trong Workspace
    const { data: existingProjects, error: projError } = await supabase
      .from('AI_Project')
      .select('*')
      .eq('workspaceId', workspace.workspaceId);

    if (projError) {
      console.error('[WorkspaceService] Error fetching AI_Projects:', projError);
      throw new AppError(500, 'DB_ERROR', 'Không thể lấy danh sách Projects.');
    }

    // 4. Lấy Learning_Material của các Project
    const projectList = existingProjects || [];
    const projectIds = projectList.map((p) => p.projectId);
    let allMaterials = [];
    if (projectIds.length > 0) {
      const { data: matData, error: matError } = await supabase
        .from('Learning_Material')
        .select('*')
        .in('projectId', projectIds);
      if (!matError && matData) {
        allMaterials = matData;
      }
    }

    const projectsMap = new Map();
    projectList.forEach((p) => {
      p.Learning_Material = allMaterials.filter((m) => m.projectId === p.projectId);
      projectsMap.set(p.projectId, p);
    });

    // 5. Đồng bộ Class Projects từ các lớp đã tham gia (UC-01)[cite: 1]
    if (enrolledCourses.length > 0) {
      for (const course of enrolledCourses) {
        let project = Array.from(projectsMap.values()).find(
          (p) =>
            p.type === 'CLASS' &&
            (p.courseId === course.courseId || (!p.courseId && p.name === course.subjectName))
        );

        if (!project) {
          try {
            const { data: newProj, error: pErr } = await supabase
              .from('AI_Project')
              .insert([{
                workspaceId: workspace.workspaceId,
                courseId: course.courseId,
                name: course.subjectName,
                type: 'CLASS',
                status: course.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'
              }])
              .select()
              .single();
            if (!pErr && newProj) {
              project = newProj;
              project.Learning_Material = [];
              projectsMap.set(project.projectId, project);
            }
          } catch (err) {
            console.error('[Auto-Sync] Error inserting class project:', err);
          }
        } else {
          const updates = {};
          if (!project.courseId) updates.courseId = course.courseId;

          // Enrollment APPROVED => Learner phải có lại quyền truy cập Class Project.
          // Nếu Project từng bị revoke khi Learner bị REMOVE, kích hoạt lại nó.
          if (course.status !== 'ARCHIVED' && project.status === 'INACTIVE') {
            updates.status = 'ACTIVE';
          }

          if (course.status === 'ARCHIVED' && project.status !== 'ARCHIVED') {
            updates.status = 'ARCHIVED';
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from('AI_Project').update(updates).eq('projectId', project.projectId);
            project.courseId = course.courseId;
            if (updates.status) project.status = updates.status;
          }
        }
        if (!project) continue;
        project.courseStatus = course.status;

        // Đồng bộ tài liệu từ CourseMaterial sang Class Project Workspace
        try {
          const { data: courseMaterials } = await supabase
            .from('CourseMaterial')
            .select('*')
            .eq('courseId', course.courseId);

          if (courseMaterials && courseMaterials.length > 0) {
            const currentMaterials = project.Learning_Material || [];
            const existingUrls = new Set(currentMaterials.map((m) => m.sourceUrl));
            const missingMaterials = courseMaterials.filter(
              (cm) => cm.resourceUrl && !existingUrls.has(cm.resourceUrl)
            );

            if (missingMaterials.length > 0) {
              const materialsToInsert = missingMaterials.map((cm) => ({
                projectId: project.projectId,
                title: cm.title || 'Course Material',
                sourceUrl: cm.resourceUrl,
                sourceType: 'COURSE',
                fileType: cm.fileType || (cm.resourceType === 'LINK' ? 'link' : 'file'),
                sizeBytes: cm.sizeBytes || 0,
                selectedAsContext: true
              }));

              const { data: inserted, error: insErr } = await supabase
                .from('Learning_Material')
                .insert(materialsToInsert)
                .select();
              if (!insErr && inserted) {
                project.Learning_Material = [...currentMaterials, ...inserted];
                projectsMap.set(project.projectId, project);
              }
            }
          }
        } catch (syncErr) {
          console.error('[Auto-Sync Materials Error]:', syncErr);
        }
      }
    }

    // Project INACTIVE là Class Project đã bị revoke khi Learner bị REMOVE.
    // Giữ dữ liệu trong DB nhưng không trả về Workspace để Learner không còn truy cập từ UI.
    workspace.AI_Project = Array.from(projectsMap.values()).filter(
      (project) => project.status !== 'INACTIVE'
    );
    workspace.AI_Projects = workspace.AI_Project;
    return workspace;
  }

  static async createPersonalProject(workspaceId, courseId, name) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new AppError(400, 'PROJECT_NAME_REQUIRED', 'Project name cannot be empty.');
    }

    // Kiểm tra tên trùng lặp (UC-01 Alternative Flow 3)[cite: 1]
    const { data: existing } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('workspaceId', workspaceId)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      throw new AppError(409, 'PROJECT_NAME_EXISTS', 'Project name already exists. Please choose another name.');
    }

    const { data, error } = await supabase
      .from('AI_Project')
      .insert([{
        workspaceId,
        courseId: courseId || null,
        name: trimmedName,
        type: 'PERSONAL',
        status: 'ACTIVE'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async toggleMaterialContext(materialId, selectedAsContext) {
    const { data, error } = await supabase
      .from('Learning_Material')
      .update({ selectedAsContext: Boolean(selectedAsContext) })
      .eq('materialId', materialId)
      .select()
      .single();
    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to update material context state.');
    return data;
  }

  static async renameProject(projectId, learnerId, newName) {
    const trimmedName = String(newName || '').trim();
    if (!trimmedName) {
      throw new AppError(400, 'PROJECT_NAME_REQUIRED', 'Project name cannot be empty.');
    }

    const { data: project, error: pError } = await supabase
      .from('AI_Project')
      .select('projectId, workspaceId, type')
      .eq('projectId', projectId)
      .maybeSingle();

    if (pError || !project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    // Kiểm tra trùng tên khi rename (UC-01 Alternative Flow 3)[cite: 1]
    const { data: duplicate } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('workspaceId', project.workspaceId)
      .ilike('name', trimmedName)
      .neq('projectId', projectId)
      .maybeSingle();

    if (duplicate) {
      throw new AppError(409, 'PROJECT_NAME_EXISTS', 'Project name already exists. Please choose another name.');
    }

    const { data: updated, error: updateError } = await supabase
      .from('AI_Project')
      .update({ name: trimmedName })
      .eq('projectId', projectId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  static async deletePersonalProject(projectId, learnerId) {
    const { data: project, error: pError } = await supabase
      .from('AI_Project')
      .select('projectId, type')
      .eq('projectId', projectId)
      .maybeSingle();

    if (pError || !project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    if (project.type === 'CLASS') {
      throw new AppError(400, 'CANNOT_DELETE_CLASS_PROJECT', 'Class projects cannot be deleted manually.');
    }

    const { error: delError } = await supabase
      .from('AI_Project')
      .delete()
      .eq('projectId', projectId);

    if (delError) throw delError;
    return true;
  }

  static async uploadPersonalMaterial(projectId, learnerId, fileBuffer, originalName, mimeType, sizeBytes) {
    const project = await this.assertProjectWritable(projectId, learnerId);

    // Kiểm tra định dạng (UC-01 Alternative Flow 2)[cite: 1]
    const ext = originalName.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      throw new AppError(400, 'INVALID_FILE_FORMAT', 'File format not supported.');
    }

    // Kiểm tra kích thước file đơn lẻ ≤ 50MB (UC-01 Alternative Flow 2)[cite: 1]
    if (sizeBytes > 50 * 1024 * 1024) {
      throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds size limit.');
    }

    // Kiểm tra tổng dung lượng Workspace Quota (UC-01 Alternative Flow 4: 500MB Limit)[cite: 1]
    const { data: workspaceProjects } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('workspaceId', project.workspaceId);
    const projectIds = workspaceProjects.map((p) => p.projectId);

    const { data: existingMaterials } = await supabase
      .from('Learning_Material')
      .select('sizeBytes')
      .in('projectId', projectIds);

    const totalUsed = (existingMaterials || []).reduce((sum, mat) => sum + Number(mat.sizeBytes || 0), 0);
    const STORAGE_LIMIT = 500 * 1024 * 1024; // 500MB

    if (totalUsed + sizeBytes > STORAGE_LIMIT) {
      throw new AppError(403, 'STORAGE_LIMIT_EXCEEDED', 'Storage capacity is full. Please delete old materials to continue.');
    }

    const safeName = originalName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    const filePath = `projects/${projectId}/${Date.now()}_${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('materials')
      .upload(filePath, fileBuffer, { contentType: mimeType });

    if (storageError) throw new AppError(500, 'STORAGE_UPLOAD_ERROR', 'Upload failed.');

    const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath);

    const { data: insertedData, error: dbError } = await supabase
      .from('Learning_Material')
      .insert([{
        projectId,
        title: originalName,
        sourceUrl: urlData.publicUrl,
        sourceType: 'PERSONAL',
        fileType: ext,
        sizeBytes,
        selectedAsContext: true
      }])
      .select()
      .single();

    if (dbError) throw new AppError(500, 'DB_ERROR', 'Failed to save material metadata.');
    return insertedData;
  }
  
  // UC-01 Alt Flow 1: Lưu trạng thái tick chọn tài liệu ngữ cảnh
  static async updateProjectActiveContext(projectId, learnerId, selectedMaterialIds) {
    const validIds = Array.isArray(selectedMaterialIds) ? selectedMaterialIds : [];
    await this.assertProjectWritable(projectId, learnerId, validIds);

    // 2. Set false cho tất cả tài liệu trong project
    await supabase
      .from('Learning_Material')
      .update({ selectedAsContext: false })
      .eq('projectId', projectId);

    // 3. Set true cho các tài liệu được chọn
    if (validIds.length > 0) {
      await supabase
        .from('Learning_Material')
        .update({ selectedAsContext: true })
        .eq('projectId', projectId)
        .in('materialId', validIds);
    }

    return { success: true, selectedMaterialIds: validIds };
  }
  static async deletePersonalMaterial(projectId, materialId, learnerId) {
    await this.assertProjectWritable(projectId, learnerId, [materialId]);

    const { data: material } = await supabase
      .from('Learning_Material')
      .select('sourceUrl')
      .eq('materialId', materialId)
      .eq('projectId', projectId)
      .maybeSingle();

    if (material && material.sourceUrl) {
      const filePath = material.sourceUrl.split('materials/')[1];
      if (filePath) {
        await supabase.storage.from('materials').remove([filePath]);
      }
    }

    const { error } = await supabase
      .from('Learning_Material')
      .delete()
      .eq('materialId', materialId)
      .eq('projectId', projectId);

    if (error) throw error;
    return true;
  }
}

module.exports = WorkspaceService;