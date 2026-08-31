// backend/service/WorkspaceIntegrationService.js
const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');
const AIServiceClient = require('./AIServiceClient');
const axios = require('axios');

class WorkspaceIntegrationService {
  /**
   * UC-14 / UC-15:
   * Khi Educator approve một Enrollment, đảm bảo Learner có AI_Workspace
   * và có đúng một CLASS Project tương ứng với Course.
   *
   * Nếu Project đã tồn tại (ví dụ Learner từng bị remove rồi enroll lại),
   * Project cũ sẽ được kích hoạt lại thay vì tạo bản ghi trùng.
   */
  static async provisionClassProject({ learnerId, courseId, projectName }) {
    if (!learnerId || !courseId) {
      throw new AppError(
        400,
        'INVALID_WORKSPACE_PROVISION_REQUEST',
        'Learner and Course are required to provision a Class Project.'
      );
    }

    // 1. Lấy hoặc tạo AI_Workspace của Learner.
    let { data: workspace, error: workspaceError } = await supabase
      .from('AI_Workspace')
      .select('*')
      .eq('learnerId', learnerId)
      .maybeSingle();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspace) {
      const { data: createdWorkspace, error: createWorkspaceError } = await supabase
        .from('AI_Workspace')
        .insert([{ learnerId }])
        .select()
        .single();

      if (createWorkspaceError) {
        throw createWorkspaceError;
      }

      workspace = createdWorkspace;
    }

    // 2. Tìm CLASS Project cũ của Course trong Workspace.
    //    Lấy tất cả CLASS Project để hỗ trợ cả dữ liệu legacy chưa có courseId.
    const { data: classProjects, error: projectLookupError } = await supabase
      .from('AI_Project')
      .select('*')
      .eq('workspaceId', workspace.workspaceId)
      .eq('type', 'CLASS');

    if (projectLookupError) {
      throw projectLookupError;
    }

    const normalizedName = String(projectName || '').trim();
    let project = (classProjects || []).find(
      (item) =>
        item.courseId === courseId ||
        (!item.courseId && normalizedName && item.name === normalizedName)
    );

    if (project) {
      const updates = {};

      if (!project.courseId) {
        updates.courseId = courseId;
      }

      if (normalizedName && project.name !== normalizedName) {
        updates.name = normalizedName;
      }

      // Learner từng bị REMOVE sẽ có Project INACTIVE.
      // Khi được approve lại, kích hoạt Project cũ thay vì tạo Project mới.
      if (project.status !== 'ACTIVE') {
        updates.status = 'ACTIVE';
      }

      if (Object.keys(updates).length > 0) {
        const { data: updatedProject, error: updateProjectError } = await supabase
          .from('AI_Project')
          .update(updates)
          .eq('projectId', project.projectId)
          .select()
          .single();

        if (updateProjectError) {
          throw updateProjectError;
        }

        project = updatedProject;
      }
    } else {
      const { data: createdProject, error: createProjectError } = await supabase
        .from('AI_Project')
        .insert([{
          workspaceId: workspace.workspaceId,
          courseId,
          name: normalizedName || 'Class Project',
          type: 'CLASS',
          status: 'ACTIVE'
        }])
        .select()
        .single();

      if (createProjectError) {
        throw createProjectError;
      }

      project = createdProject;
    }

    // 3. Đồng bộ các Course Material hiện có vào Class Project vừa provision.
    const { data: courseMaterials, error: materialLookupError } = await supabase
      .from('CourseMaterial')
      .select('title, resourceUrl, resourceType, fileType, sizeBytes, available')
      .eq('courseId', courseId)
      .eq('available', true);

    if (materialLookupError) {
      throw materialLookupError;
    }

    if (courseMaterials && courseMaterials.length > 0) {
      const { data: existingMaterials, error: existingMaterialError } = await supabase
        .from('Learning_Material')
        .select('sourceUrl')
        .eq('projectId', project.projectId);

      if (existingMaterialError) {
        throw existingMaterialError;
      }

      const existingUrls = new Set(
        (existingMaterials || [])
          .map((item) => item.sourceUrl)
          .filter(Boolean)
      );

      const missingMaterials = courseMaterials
        .filter(
          (material) =>
            material.resourceUrl && !existingUrls.has(material.resourceUrl)
        )
        .map((material) => ({
          projectId: project.projectId,
          title: material.title || 'Course Material',
          sourceUrl: material.resourceUrl,
          sourceType: 'CLASS',
          fileType:
            material.fileType ||
            (material.resourceType === 'LINK' ? 'link' : 'file'),
          sizeBytes: material.sizeBytes || 0,
          selectedAsContext: true
        }));

      if (missingMaterials.length > 0) {
        const { error: insertMaterialError } = await supabase
          .from('Learning_Material')
          .insert(missingMaterials);

        if (insertMaterialError) {
          throw insertMaterialError;
        }
      }
    }

    return {
      workspaceId: workspace.workspaceId,
      projectId: project.projectId,
      project
    };
  }

  /**
   * UC-14:
   * Khi Educator remove một APPROVED Learner khỏi Course, thu hồi quyền truy
   * cập Class Project nhưng không xóa dữ liệu học tập của Learner.
   * Project được chuyển sang INACTIVE để có thể khôi phục nếu Learner enroll lại.
   */
  static async revokeClassProjectAccess({ learnerId, courseId }) {
    if (!learnerId || !courseId) {
      throw new AppError(
        400,
        'INVALID_WORKSPACE_REVOKE_REQUEST',
        'Learner and Course are required to revoke Class Project access.'
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('AI_Workspace')
      .select('workspaceId')
      .eq('learnerId', learnerId)
      .maybeSingle();

    if (workspaceError) {
      throw workspaceError;
    }

    // Learner chưa từng mở Workspace thì không có gì cần revoke.
    if (!workspace) {
      return {
        revoked: false,
        reason: 'WORKSPACE_NOT_FOUND'
      };
    }

    const { data: projects, error: projectLookupError } = await supabase
      .from('AI_Project')
      .select('projectId, status')
      .eq('workspaceId', workspace.workspaceId)
      .eq('courseId', courseId)
      .eq('type', 'CLASS');

    if (projectLookupError) {
      throw projectLookupError;
    }

    if (!projects || projects.length === 0) {
      return {
        revoked: false,
        reason: 'CLASS_PROJECT_NOT_FOUND'
      };
    }

    const projectIds = projects.map((item) => item.projectId);

    const { data: updatedProjects, error: revokeError } = await supabase
      .from('AI_Project')
      .update({ status: 'INACTIVE' })
      .in('projectId', projectIds)
      .select();

    if (revokeError) {
      throw revokeError;
    }

    return {
      revoked: true,
      projectIds,
      projects: updatedProjects || []
    };
  }

  /**
   * UC-13 integration: when a Course is archived, every matching Class Project
   * becomes history-only immediately. Data is preserved; only interactive/AI
   * operations are disabled by the Project status and server-side guards.
   */
  static async archiveClassProjects(courseId) {
    if (!courseId) return { archived: false, projectIds: [] };

    const { data: projects, error: lookupError } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('courseId', courseId)
      .eq('type', 'CLASS');

    if (lookupError) throw lookupError;
    if (!projects || projects.length === 0) {
      return { archived: true, projectIds: [] };
    }

    const projectIds = projects.map((project) => project.projectId);
    const { error: updateError } = await supabase
      .from('AI_Project')
      .update({ status: 'ARCHIVED' })
      .in('projectId', projectIds);

    if (updateError) throw updateError;
    return { archived: true, projectIds };
  }

  /** Restore Class Projects when a Course is restored. */
  static async unarchiveClassProjects(courseId) {
    if (!courseId) return { restored: false, projectIds: [] };

    const { data: projects, error: lookupError } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('courseId', courseId)
      .eq('type', 'CLASS')
      .eq('status', 'ARCHIVED');

    if (lookupError) throw lookupError;
    if (!projects || projects.length === 0) {
      return { restored: true, projectIds: [] };
    }

    const projectIds = projects.map((project) => project.projectId);
    const { error: updateError } = await supabase
      .from('AI_Project')
      .update({ status: 'ACTIVE' })
      .in('projectId', projectIds);

    if (updateError) throw updateError;
    return { restored: true, projectIds };
  }

  static async syncMaterialToClassProjects(courseId, courseMaterial) {
    try {
      const { data: projects } = await supabase
        .from('AI_Project')
        .select('projectId')
        .eq('courseId', courseId)
        .eq('type', 'CLASS')
        .eq('status', 'ACTIVE');

      if (!projects || projects.length === 0) return;

      const materialsToInsert = projects.map((p) => ({
        projectId: p.projectId,
        title: courseMaterial.title || 'Course Material',
        sourceUrl: courseMaterial.resourceUrl,
        sourceType: 'CLASS',
        fileType: courseMaterial.fileType || (courseMaterial.resourceType === 'LINK' ? 'link' : 'file'),
        sizeBytes: courseMaterial.sizeBytes || 0,
        selectedAsContext: true
      }));

      await supabase.from('Learning_Material').insert(materialsToInsert);
    } catch (e) {
      console.error('[Integration] Lỗi đồng bộ tài liệu sang Workspace:', e);
    }
  }

  static async updateSynchronizedMaterial(courseId, oldResourceUrl, updatedMaterial) {
    try {
      const { data: projects } = await supabase
        .from('AI_Project')
        .select('projectId')
        .eq('courseId', courseId)
        .eq('type', 'CLASS')
        .eq('status', 'ACTIVE');

      if (!projects || projects.length === 0) return;
      const projectIds = projects.map((p) => p.projectId);

      await supabase
        .from('Learning_Material')
        .update({
          title: updatedMaterial.title,
          sourceUrl: updatedMaterial.resourceUrl,
          fileType: updatedMaterial.fileType || (updatedMaterial.resourceType === 'LINK' ? 'link' : 'file'),
          sizeBytes: updatedMaterial.sizeBytes || 0
        })
        .in('projectId', projectIds)
        .eq('sourceUrl', oldResourceUrl);
    } catch (e) {
      console.error('[Integration] Lỗi cập nhật tài liệu trong Workspace:', e);
    }
  }


  static _normalizeMimeType(fileType, sourceUrl = '') {
    const raw = String(fileType || '').toLowerCase().trim();
    if (raw === 'application/pdf' || raw === 'pdf') return 'application/pdf';
    if (
      raw === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      raw === 'docx'
    ) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (raw === 'image/jpeg' || raw === 'image/jpg' || raw === 'jpeg' || raw === 'jpg') {
      return 'image/jpeg';
    }
    if (raw === 'image/png' || raw === 'png') return 'image/png';
    if (raw === 'image/webp' || raw === 'webp') return 'image/webp';

    const cleanUrl = String(sourceUrl || '').split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.pdf')) return 'application/pdf';
    if (cleanUrl.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
    if (cleanUrl.endsWith('.png')) return 'image/png';
    if (cleanUrl.endsWith('.webp')) return 'image/webp';
    return null;
  }

  static _getMaterialsStoragePath(sourceUrl) {
    const rawUrl = String(sourceUrl || '').trim();
    if (!rawUrl) return '';

    try {
      if (/^https?:\/\//i.test(rawUrl)) {
        const parsedUrl = new URL(rawUrl);
        const decodedPath = decodeURIComponent(parsedUrl.pathname);
        const marker = '/materials/';
        const markerIndex = decodedPath.indexOf(marker);

        if (markerIndex >= 0) {
          return decodedPath
            .slice(markerIndex + marker.length)
            .replace(/^\/+/, '')
            .trim();
        }

        return '';
      }

      let filePath = decodeURIComponent(rawUrl.split('?')[0]);
      if (filePath.startsWith('materials/')) {
        filePath = filePath.slice('materials/'.length);
      }

      return filePath.replace(/^\/+/, '').trim();
    } catch (_) {
      return '';
    }
  }

  static async _downloadLearningMaterial(material) {
    const sourceUrl = String(material?.sourceUrl || '').trim();
    if (!sourceUrl) {
      throw new Error('Learning Material does not have a source URL.');
    }

    // Learning Materials stored in the project's Supabase "materials" bucket
    // must be downloaded with the server-side Storage client. Opening the
    // public/signed URL directly can fail when the bucket is private or when a
    // previously issued signed URL has expired.
    const storagePath = this._getMaterialsStoragePath(sourceUrl);

    if (storagePath) {
      const { data: downloaded, error: downloadError } = await supabase.storage
        .from('materials')
        .download(storagePath);

      if (downloadError || !downloaded) {
        throw downloadError || new Error('Unable to download Learning Material from Storage.');
      }

      if (Buffer.isBuffer(downloaded)) {
        return downloaded;
      }

      if (typeof downloaded.arrayBuffer === 'function') {
        return Buffer.from(await downloaded.arrayBuffer());
      }

      if (downloaded instanceof ArrayBuffer) {
        return Buffer.from(downloaded);
      }

      return Buffer.from(downloaded);
    }

    // Keep support for external URLs that are not stored in Supabase.
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    return Buffer.from(response.data);
  }

  static _classifyMaterialProcessingFailure(material, error, fileBuffer = null, mimeType = '') {
    const title = String(material?.title || 'Selected Learning Material').trim();
    const message = String(error?.message || '').trim();
    const normalized = message.toLowerCase();

    const isPdf = mimeType === 'application/pdf';
    const isDocx =
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (
      isPdf &&
      fileBuffer &&
      Buffer.isBuffer(fileBuffer) &&
      fileBuffer.includes(Buffer.from('/Encrypt'))
    ) {
      return {
        code: 'DOCUMENT_PASSWORD_PROTECTED',
        message: `"${title}" is password-protected or encrypted and cannot be processed. Remove the password and upload an unencrypted PDF.`
      };
    }

    if (
      /password|password-protected|encrypted|encryption|decrypt/.test(normalized)
    ) {
      return {
        code: 'DOCUMENT_PASSWORD_PROTECTED',
        message: `"${title}" is password-protected or encrypted and cannot be processed. Remove the password and upload an unencrypted copy.`
      };
    }

    if (
      /corrupt|corrupted|damaged|malformed|cannot decode|unable to decode|decode error|parse error|cannot parse|invalid pdf|invalid docx|bad zip|central directory|end[- ]of[- ]file|xref/.test(
        normalized
      )
    ) {
      return {
        code: 'DOCUMENT_CORRUPTED',
        message: `"${title}" appears to be corrupted or invalid and cannot be processed. Upload a valid readable copy of the file.`
      };
    }

    if (
      isPdf &&
      fileBuffer &&
      Buffer.isBuffer(fileBuffer) &&
      !fileBuffer.subarray(0, 5).equals(Buffer.from('%PDF-'))
    ) {
      return {
        code: 'DOCUMENT_CORRUPTED',
        message: `"${title}" is not a valid readable PDF file. Upload a valid PDF copy.`
      };
    }

    if (
      isDocx &&
      fileBuffer &&
      Buffer.isBuffer(fileBuffer) &&
      !fileBuffer.subarray(0, 2).equals(Buffer.from('PK'))
    ) {
      return {
        code: 'DOCUMENT_CORRUPTED',
        message: `"${title}" is not a valid readable DOCX file. Upload a valid DOCX copy.`
      };
    }

    return {
      code: error?.code || 'DOCUMENT_PROCESSING_FAILED',
      message:
        message && message !== 'The AI service returned an error.'
          ? `"${title}" could not be processed: ${message}`
          : `"${title}" does not contain readable content that can be processed.`
    };
  }

  static _buildExtractionFileName(material) {
    try {
      const pathname = new URL(material.sourceUrl).pathname;
      const urlName = decodeURIComponent(pathname.split('/').pop() || '').trim();
      if (urlName && urlName.includes('.')) return urlName;
    } catch (_) {
      // Fall back to title below.
    }

    const mimeType = this._normalizeMimeType(material.fileType, material.sourceUrl);
    const extByMime = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };
    const title = String(material.title || 'learning-material').trim() || 'learning-material';
    const ext = extByMime[mimeType] || '';
    return title.toLowerCase().endsWith(ext) ? title : `${title}${ext}`;
  }

  /**
   * Keep ai_service unchanged.
   *
   * Course Materials are copied into each Learner's Class Project as
   * Learning_Material rows. Those copied rows have their own materialId, so they
   * also need a Processed_Document before Chat/Quiz/Flashcards can retrieve text.
   *
   * This method lazily prepares only the selected materials before an AI call.
   * Existing COMPLETED documents are reused; missing ones are downloaded from
   * sourceUrl and sent to the existing /api/extract endpoint via AIServiceClient.
   */
  static async ensureMaterialsProcessed(projectId, materialIds = []) {
    const requestedIds = [...new Set((materialIds || []).map(String).filter(Boolean))];
    if (!projectId || requestedIds.length === 0) {
      return { readyMaterialIds: [], failedMaterialIds: [] };
    }

    const { data: materials, error: materialError } = await supabase
      .from('Learning_Material')
      .select('materialId, projectId, title, sourceUrl, sourceType, fileType')
      .eq('projectId', projectId)
      .in('materialId', requestedIds);

    if (materialError) throw materialError;

    const foundIds = new Set((materials || []).map((m) => String(m.materialId)));
    const missingFromProject = requestedIds.filter((id) => !foundIds.has(id));
    if (missingFromProject.length > 0) {
      throw new AppError(
        400,
        'MATERIAL_NOT_IN_PROJECT',
        'One or more selected Learning Materials do not belong to the active Project.'
      );
    }

    const { data: completedDocs, error: completedError } = await supabase
      .from('Processed_Document')
      .select('materialId')
      .in('materialId', requestedIds)
      .eq('status', 'COMPLETED');

    if (completedError) throw completedError;

    const ready = new Set((completedDocs || []).map((row) => String(row.materialId)));
    const failed = [];
    const processingFailures = [];

    for (const material of materials || []) {
      const materialId = String(material.materialId);
      if (ready.has(materialId)) continue;

      const mimeType = this._normalizeMimeType(material.fileType, material.sourceUrl);
      if (!material.sourceUrl || !mimeType) {
        failed.push(materialId);
        processingFailures.push({
          materialId,
          code: 'DOCUMENT_PROCESSING_FAILED',
          message: `"${material.title || 'Selected Learning Material'}" does not have a supported readable file resource.`
        });
        continue;
      }

      let fileBuffer = null;

      try {
        fileBuffer = await this._downloadLearningMaterial(material);
        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('Downloaded Learning Material is empty.');
        }

        const preliminaryFailure = this._classifyMaterialProcessingFailure(
          material,
          null,
          fileBuffer,
          mimeType
        );

        if (
          preliminaryFailure.code === 'DOCUMENT_PASSWORD_PROTECTED' ||
          preliminaryFailure.code === 'DOCUMENT_CORRUPTED'
        ) {
          throw new AppError(
            422,
            preliminaryFailure.code,
            preliminaryFailure.message
          );
        }

        const fileName = this._buildExtractionFileName(material);

        await AIServiceClient.extractDocument(
          material.materialId,
          fileBuffer,
          fileName,
          mimeType
        );
        ready.add(materialId);
      } catch (error) {
        failed.push(materialId);

        const classified = this._classifyMaterialProcessingFailure(
          material,
          error,
          fileBuffer,
          mimeType
        );

        processingFailures.push({
          materialId,
          ...classified
        });

        console.error(
          `[WorkspaceIntegration] Failed to prepare material ${material.materialId} for AI:`,
          classified.message
        );
      }
    }

    if (ready.size === 0) {
      const passwordProtectedFailure = processingFailures.find(
        (failure) => failure.code === 'DOCUMENT_PASSWORD_PROTECTED'
      );

      if (passwordProtectedFailure) {
        throw new AppError(
          422,
          passwordProtectedFailure.code,
          passwordProtectedFailure.message
        );
      }

      const corruptedFailure = processingFailures.find(
        (failure) => failure.code === 'DOCUMENT_CORRUPTED'
      );

      if (corruptedFailure) {
        throw new AppError(
          422,
          corruptedFailure.code,
          corruptedFailure.message
        );
      }

      if (processingFailures.length === 1) {
        throw new AppError(
          422,
          processingFailures[0].code || 'DOCUMENT_PROCESSING_FAILED',
          processingFailures[0].message
        );
      }

      throw new AppError(
        422,
        'NO_READABLE_CONTENT',
        'No readable content found in the selected Learning Materials.'
      );
    }

    return {
      readyMaterialIds: requestedIds.filter((id) => ready.has(id)),
      failedMaterialIds: failed
    };
  }

  // UC-05 Alt Flow 2: Xóa chính xác tài liệu theo resourceUrl / title
  static async removeSynchronizedMaterial(courseId, targetResourceUrl, materialTitle = null) {
    try {
      const { data: projects } = await supabase
        .from('AI_Project')
        .select('projectId')
        .eq('courseId', courseId)
        .eq('type', 'CLASS');

      if (!projects || projects.length === 0) return;
      const projectIds = projects.map((p) => p.projectId);

      let query = supabase
        .from('Learning_Material')
        .delete()
        .in('projectId', projectIds)
        .in('sourceType', ['CLASS', 'COURSE']);

      if (targetResourceUrl) {
        query = query.eq('sourceUrl', targetResourceUrl);
      } else if (materialTitle) {
        query = query.eq('title', materialTitle);
      }

      await query;
    } catch (e) {
      console.error('[Integration] Lỗi xóa tài liệu khỏi Workspace:', e);
    }
  }
}

module.exports = WorkspaceIntegrationService;
