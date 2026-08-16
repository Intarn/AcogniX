// backend/service/CourseContentService.js
const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');
const NotificationService = require('./NotificationService');
const WorkspaceIntegrationService = require('./WorkspaceIntegrationService');
const { ResourceType } = require('../enums/CourseContentEnums');
const { EnrollmentStatus } = require('../enums/ClassroomEnums');

const BUCKET_MATERIALS = 'materials';
const BUCKET_ANNOUNCEMENTS = 'announcements';

class CourseContentService {
  // =========================================================================
  // UC-05: MANAGE COURSE MATERIALS (Educator)
  // =========================================================================

  // Basic Flow (UC-05): Thêm tài liệu học tập (File hoặc Link)
  static async addMaterial(educatorId, courseId, title, description, resourceType, file, linkUrl) {
    await this._verifyCourseOwnership(courseId, educatorId);

    if (!title || !String(title).trim()) {
      throw new AppError(400, 'TITLE_REQUIRED', 'Material title is required.');
    }

    let resourceUrl = linkUrl ? String(linkUrl).trim() : null;
    let fileType = null;
    let sizeBytes = 0;

    if (resourceType === ResourceType.FILE) {
      if (!file) {
        throw new AppError(400, 'FILE_REQUIRED', 'Please upload a material file.');
      }
      const fileExt = file.originalname.split('.').pop();
      const safeName = file.originalname.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
      const filePath = `${courseId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_MATERIALS)
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadError) {
        throw new AppError(500, 'UPLOAD_FAILED', 'Failed to upload material file.');
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET_MATERIALS).getPublicUrl(filePath);
      resourceUrl = publicUrlData?.publicUrl || filePath;
      fileType = file.mimetype;
      sizeBytes = file.size;
    } else if (resourceType === ResourceType.LINK) {
      if (!resourceUrl) {
        throw new AppError(400, 'LINK_URL_REQUIRED', 'A link URL is required.');
      }
      fileType = 'link';
      sizeBytes = 0;
    } else {
      throw new AppError(400, 'INVALID_RESOURCE_TYPE', 'Invalid resource type.');
    }

    const { data: material, error: dbError } = await supabase
      .from('CourseMaterial')
      .insert([{
        courseId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        resourceType,
        resourceUrl,
        fileType,
        sizeBytes,
        available: true
      }])
      .select()
      .single();

    if (dbError) throw new AppError(500, 'DB_ERROR', 'Failed to save course material.');

    // Đồng bộ tài liệu mới vào Workspace của các học viên trong lớp
    await WorkspaceIntegrationService.syncMaterialToClassProjects(courseId, material);

    // Gửi email thông báo cho các học viên đã được phê duyệt trong lớp
    await NotificationService.notifyCourseMaterialChanged({
      courseId,
      material,
      action: 'ADDED'
    });

    return material;
  }

  // Basic Flow (UC-05): Chỉnh sửa thông tin / thay thế file hoặc link tài liệu
  static async updateMaterial(educatorId, materialId, updates, newFile) {
    const oldMaterial = await this._getMaterialAndVerifyOwnership(materialId, educatorId);
    const oldResourceUrl = oldMaterial.resourceUrl;

    const updateData = {};

    if (updates.title !== undefined) {
      const trimmedTitle = String(updates.title || '').trim();
      if (!trimmedTitle) {
        throw new AppError(400, 'TITLE_REQUIRED', 'Material title cannot be empty.');
      }
      updateData.title = trimmedTitle;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description ? String(updates.description).trim() : null;
    }

    const targetResourceType = updates.resourceType || oldMaterial.resourceType;
    if (updates.resourceType !== undefined) {
      updateData.resourceType = targetResourceType;
    }

    // 1. Trường hợp thay thế bằng File mới
    if (targetResourceType === ResourceType.FILE && newFile) {
      const safeName = newFile.originalname.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
      const filePath = `${oldMaterial.courseId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_MATERIALS)
        .upload(filePath, newFile.buffer, {
          contentType: newFile.mimetype,
          upsert: true
        });

      if (uploadError) {
        throw new AppError(500, 'UPLOAD_FAILED', 'Failed to upload new material file.');
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET_MATERIALS).getPublicUrl(filePath);
      updateData.resourceUrl = publicUrlData?.publicUrl || filePath;
      updateData.fileType = newFile.mimetype;
      updateData.sizeBytes = newFile.size;

      // Dọn dẹp file cũ trên Storage nếu trước đó là File
      if (oldMaterial.resourceType === ResourceType.FILE && oldMaterial.resourceUrl?.includes(BUCKET_MATERIALS)) {
        const oldFilePath = oldMaterial.resourceUrl.split(`${BUCKET_MATERIALS}/`)[1];
        if (oldFilePath) {
          await supabase.storage.from(BUCKET_MATERIALS).remove([oldFilePath]);
        }
      }
    }
    // 2. Trường hợp thay thế hoặc cập nhật Link URL
    else if (targetResourceType === ResourceType.LINK && updates.linkUrl !== undefined) {
      const linkUrl = String(updates.linkUrl || '').trim();
      if (!linkUrl) {
        throw new AppError(400, 'LINK_URL_REQUIRED', 'A link URL is required.');
      }
      updateData.resourceUrl = linkUrl;
      updateData.fileType = 'link';
      updateData.sizeBytes = 0;

      // Xóa file cũ nếu đổi từ FILE sang LINK
      if (oldMaterial.resourceType === ResourceType.FILE && oldMaterial.resourceUrl?.includes(BUCKET_MATERIALS)) {
        const oldFilePath = oldMaterial.resourceUrl.split(`${BUCKET_MATERIALS}/`)[1];
        if (oldFilePath) {
          await supabase.storage.from(BUCKET_MATERIALS).remove([oldFilePath]);
        }
      }
    }

    const { data: updatedMaterial, error } = await supabase
      .from('CourseMaterial')
      .update(updateData)
      .eq('materialId', materialId)
      .select()
      .single();

    if (error) {
      console.error('Supabase CourseMaterial update error:', error);
      throw new AppError(500, 'UPDATE_FAILED', 'Failed to update material.');
    }

    // Cập nhật thông tin tài liệu đã đồng bộ trong Workspace của học viên
    await WorkspaceIntegrationService.updateSynchronizedMaterial(
      updatedMaterial.courseId,
      oldResourceUrl,
      updatedMaterial
    );

    // Gửi thông báo cập nhật tài liệu
    await NotificationService.notifyCourseMaterialChanged({
      courseId: updatedMaterial.courseId,
      material: updatedMaterial,
      action: 'UPDATED'
    });

    return updatedMaterial;
  }

  // Basic Flow & Alt Flow 2 (UC-05): Xóa tài liệu khỏi lớp và Workspace học viên
  static async deleteMaterial(educatorId, materialId) {
    const material = await this._getMaterialAndVerifyOwnership(materialId, educatorId);

    // Xóa file trên Storage nếu tài liệu là FILE
    if (material.resourceType === ResourceType.FILE && material.resourceUrl) {
      const filePath = material.resourceUrl.split(`${BUCKET_MATERIALS}/`)[1];
      if (filePath) {
        await supabase.storage.from(BUCKET_MATERIALS).remove([filePath]);
      }
    }

    // Xóa đúng tài liệu khỏi tất cả Workspace đã đồng bộ của học viên
    await WorkspaceIntegrationService.removeSynchronizedMaterial(material.courseId, material.resourceUrl);

    const { error } = await supabase
      .from('CourseMaterial')
      .delete()
      .eq('materialId', materialId);

    if (error) throw new AppError(500, 'DELETE_FAILED', 'Failed to delete material.');

    // Gửi thông báo xóa tài liệu
    await NotificationService.notifyCourseMaterialChanged({
      courseId: material.courseId,
      material,
      action: 'DELETED'
    });

    return true;
  }

  // Lấy danh sách tài liệu cho Giáo viên
  static async getMaterialsForEducator(educatorId, courseId) {
    await this._verifyCourseOwnership(courseId, educatorId);

    const { data, error } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('courseId', courseId)
      .order('uploadedAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch course materials.');
    return data || [];
  }

  // =========================================================================
  // UC-16: VIEW COURSE MATERIALS & ANNOUNCEMENTS (Learner)
  // =========================================================================

  // Basic Flow (UC-16): Học viên xem tài liệu lớp học
  static async getMaterialsForLearner(learnerId, courseId) {
    await this._verifyLearnerEnrollment(courseId, learnerId);

    // Alt Flow 1 (UC-16): Lớp chưa có tài liệu -> trả về []
    const { data, error } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('courseId', courseId)
      .eq('available', true)
      .order('uploadedAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch course materials.');
    return data || [];
  }

  // UC16 UI03/UI05/UI07: Resolve the actual Storage object through the
  // authenticated backend. This makes built-in viewing/downloading reliable
  // and lets the system detect a deleted or obviously corrupted file.
  static async getMaterialFileForLearner(learnerId, materialId) {
    const { data: material, error: materialError } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('materialId', materialId)
      .eq('available', true)
      .maybeSingle();

    if (materialError) throw materialError;
    if (!material) {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    await this._verifyLearnerEnrollment(material.courseId, learnerId);

    if (material.resourceType !== ResourceType.FILE || !material.resourceUrl) {
      throw new AppError(400, 'MATERIAL_NOT_FILE', 'This material is not a downloadable file.');
    }

    const marker = `${BUCKET_MATERIALS}/`;
    const markerIndex = String(material.resourceUrl).indexOf(marker);
    if (markerIndex < 0) {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    const filePath = decodeURIComponent(
      String(material.resourceUrl).slice(markerIndex + marker.length).split('?')[0]
    );
    if (!filePath) {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    const { data: downloaded, error: downloadError } = await supabase.storage
      .from(BUCKET_MATERIALS)
      .download(filePath);

    if (downloadError || !downloaded) {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    let buffer;
    if (Buffer.isBuffer(downloaded)) {
      buffer = downloaded;
    } else if (typeof downloaded.arrayBuffer === 'function') {
      buffer = Buffer.from(await downloaded.arrayBuffer());
    } else {
      buffer = Buffer.from(downloaded);
    }

    if (!buffer || buffer.length === 0) {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    const mimeType = String(material.fileType || 'application/octet-stream').toLowerCase();
    const isPdf = mimeType.includes('pdf');
    const isDocx = mimeType.includes('wordprocessingml') || mimeType.includes('docx');

    // Lightweight integrity guards for the two UC16 document formats. They
    // catch common deleted/corrupted fixtures without attempting a full parser.
    if (isPdf) {
      const headerValid = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
      const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString('latin1');
      const trailerValid = tail.includes('%%EOF');
      if (!headerValid || !trailerValid) {
        throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
      }
    }
    if (isDocx && buffer.subarray(0, 2).toString('ascii') !== 'PK') {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    const urlPath = String(material.resourceUrl).split('?')[0];
    const extensionMatch = urlPath.match(/\.([A-Za-z0-9]+)$/);
    const extension = extensionMatch ? `.${extensionMatch[1]}` : '';
    const safeBaseName = String(material.title || 'course-material')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .trim() || 'course-material';
    const fileName = safeBaseName.toLowerCase().endsWith(extension.toLowerCase())
      ? safeBaseName
      : `${safeBaseName}${extension}`;

    return {
      buffer,
      mimeType: material.fileType || 'application/octet-stream',
      fileName,
      material
    };
  }

  // Basic Flow (UC-16): Học viên xem bảng tin thông báo
  static async getAnnouncementsForLearner(learnerId, courseId) {
    await this._verifyLearnerEnrollment(courseId, learnerId);

    const { data, error } = await supabase
      .from('Announcement')
      .select('*')
      .eq('courseId', courseId)
      .order('publishedAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch announcements.');
    return data || [];
  }

  // =========================================================================
  // UC-17: POST ANNOUNCEMENTS (Educator)
  // =========================================================================

  // Basic Flow & Alternative Flows (UC-17): Đăng thông báo mới
  static async publishAnnouncement(educatorId, courseId, title, body, files) {
    await this._verifyCourseOwnership(courseId, educatorId);

    // Alt Flow 1 (UC-17): Kiểm tra trường bắt buộc
    if (!title || !body || !String(title).trim() || !String(body).trim()) {
      throw new AppError(
        400,
        'MISSING_FIELDS',
        'Title and content cannot be empty. Please fill in the required fields.'
      );
    }

    const { data: announcement, error: dbError } = await supabase
      .from('Announcement')
      .insert([{
        courseId,
        title: String(title).trim(),
        body: String(body).trim(),
        publishedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (dbError) throw new AppError(500, 'DB_ERROR', 'Failed to save announcement.');

    // Tải lên các file đính kèm nếu có
    let attachmentUrls = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const originalName = file.originalname || 'attachment';
        const safeFileName = originalName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
        const filePath = `${courseId}/${announcement.announcementId}/${safeFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET_ANNOUNCEMENTS)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (uploadErr) {
          console.error('[Announcement Storage Error] Failed to upload file:', uploadErr);
        } else {
          const { data: urlData } = supabase.storage.from(BUCKET_ANNOUNCEMENTS).getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            attachmentUrls.push(urlData.publicUrl);
          }
        }
      }

      if (attachmentUrls.length > 0) {
        await supabase
          .from('Announcement')
          .update({ attachmentUrls })
          .eq('announcementId', announcement.announcementId);
        announcement.attachmentUrls = attachmentUrls;
      }
    }

    // Alt Flow 3 (UC-17): Gửi email thông báo (lỗi gửi mail không rollback thông báo)
    const notification = await NotificationService.notifyAnnouncementPublished({
      courseId,
      title: announcement.title,
      body: announcement.body
    });

    const emailFailed = notification.sent === false && notification.reason === 'EMAIL_DELIVERY_FAILED';

    return {
      announcement,
      emailFailed,
      warningMessage: emailFailed
        ? 'The announcement was posted successfully, but email notifications could not be sent at this time due to a server issue.'
        : null
    };
  }

  static async getAnnouncementsForEducator(educatorId, courseId) {
    await this._verifyCourseOwnership(courseId, educatorId);

    const { data, error } = await supabase
      .from('Announcement')
      .select('*')
      .eq('courseId', courseId)
      .order('publishedAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch announcements.');
    return data || [];
  }

  // Xóa thông báo và dọn dẹp Storage đính kèm
  static async deleteAnnouncement(educatorId, announcementId) {
    const { data: announcement, error } = await supabase
      .from('Announcement')
      .select('*')
      .eq('announcementId', announcementId)
      .single();

    if (error || !announcement) {
      throw new AppError(404, 'NOT_FOUND', 'Announcement not found.');
    }

    await this._verifyCourseOwnership(announcement.courseId, educatorId);

    if (Array.isArray(announcement.attachmentUrls) && announcement.attachmentUrls.length > 0) {
      const filePathsToRemove = announcement.attachmentUrls
        .map((url) => {
          const parts = url.split(`${BUCKET_ANNOUNCEMENTS}/`);
          return parts[1];
        })
        .filter(Boolean);

      if (filePathsToRemove.length > 0) {
        await supabase.storage.from(BUCKET_ANNOUNCEMENTS).remove(filePathsToRemove);
      }
    }

    const { error: deleteError } = await supabase
      .from('Announcement')
      .delete()
      .eq('announcementId', announcementId);

    if (deleteError) {
      throw new AppError(500, 'DELETE_FAILED', 'Failed to delete announcement.');
    }

    return true;
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  static async _verifyCourseOwnership(courseId, educatorId) {
    const { data, error } = await supabase
      .from('Course')
      .select('educatorId')
      .eq('courseId', courseId)
      .maybeSingle();

    if (error || !data) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
    if (data.educatorId !== educatorId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to manage this course.');
    }
  }

  static async _getMaterialAndVerifyOwnership(materialId, educatorId) {
    const { data: material, error } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('materialId', materialId)
      .maybeSingle();

    if (error || !material) throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    await this._verifyCourseOwnership(material.courseId, educatorId);
    return material;
  }

  static async _verifyLearnerEnrollment(courseId, learnerId) {
    const { data, error } = await supabase
      .from('Enrollment')
      .select('status')
      .eq('courseId', courseId)
      .eq('learnerId', learnerId)
      .eq('status', EnrollmentStatus.APPROVED)
      .maybeSingle();

    if (error || !data) {
      throw new AppError(403, 'FORBIDDEN', 'You must be an approved member to access this class content.');
    }
  }
}

module.exports = CourseContentService;