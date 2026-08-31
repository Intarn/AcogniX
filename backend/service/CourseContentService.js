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

    return await this._withEducatorAccessibleResourceUrl(material);
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

    return await this._withEducatorAccessibleResourceUrl(updatedMaterial);
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

    const orderedMaterials = this._sortMaterialsForDisplay(data || []);
    return Promise.all(
      orderedMaterials.map((material) =>
        this._withEducatorAccessibleResourceUrl(material)
      )
    );
  }

  static async reorderMaterials(educatorId, courseId, materialOrders) {
    await this._verifyCourseOwnership(courseId, educatorId);

    if (!Array.isArray(materialOrders) || materialOrders.length === 0) {
      throw new AppError(400, 'INVALID_MATERIAL_ORDER', 'Material order is required.');
    }

    const normalized = materialOrders
      .map((item, index) => ({
        materialId: item?.materialId,
        orderIndex: Number.isFinite(Number(item?.orderIndex))
          ? Number(item.orderIndex)
          : index + 1
      }))
      .filter((item) => item.materialId !== undefined && item.materialId !== null)
      .sort((first, second) => first.orderIndex - second.orderIndex);

    const { data: courseMaterials, error: materialError } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('courseId', courseId);

    if (materialError) {
      throw new AppError(500, 'DB_ERROR', 'Failed to load Course Materials for reordering.');
    }

    const allowedIds = new Set((courseMaterials || []).map((item) => String(item.materialId)));
    if (
      normalized.length !== allowedIds.size ||
      normalized.some((item) => !allowedIds.has(String(item.materialId)))
    ) {
      throw new AppError(
        400,
        'INVALID_MATERIAL_ORDER',
        'The material order does not match this Course.'
      );
    }

    // Use a dedicated orderIndex column when the deployed schema supports it.
    // Older project schemas do not contain that column, so detect that case
    // before writing and fall back to the existing uploadedAt display order.
    const { error: orderColumnCheckError } = await supabase
      .from('CourseMaterial')
      .select('materialId, orderIndex')
      .eq('courseId', courseId)
      .limit(1);

    const orderColumnErrorText = orderColumnCheckError
      ? `${orderColumnCheckError.message || ''} ${orderColumnCheckError.details || ''} ${orderColumnCheckError.hint || ''}`
      : '';
    const missingOrderIndexColumn =
      Boolean(orderColumnCheckError) && /orderindex/i.test(orderColumnErrorText);

    if (orderColumnCheckError && !missingOrderIndexColumn) {
      throw new AppError(
        500,
        'REORDER_FAILED',
        'Failed to verify Course Material ordering support.'
      );
    }

    if (!orderColumnCheckError) {
      for (const item of normalized) {
        const { error } = await supabase
          .from('CourseMaterial')
          .update({ orderIndex: item.orderIndex })
          .eq('materialId', item.materialId)
          .eq('courseId', courseId);

        if (error) {
          throw new AppError(500, 'REORDER_FAILED', 'Failed to reorder Course Materials.');
        }
      }
    } else {
      // Backward-compatible fallback: preserve the existing timestamp values as
      // display-order slots, then assign those slots according to the requested
      // order. This makes Up/Down persistent without requiring a DB migration.
      const existingSlots = (courseMaterials || [])
        .map((item) => new Date(item.uploadedAt || 0))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((first, second) => second.getTime() - first.getTime())
        .map((date) => date.toISOString());

      const fallbackBaseTime = Date.now();
      for (let index = 0; index < normalized.length; index += 1) {
        const item = normalized[index];
        const uploadedAt =
          existingSlots[index] ||
          new Date(fallbackBaseTime - index * 1000).toISOString();

        const { error } = await supabase
          .from('CourseMaterial')
          .update({ uploadedAt })
          .eq('materialId', item.materialId)
          .eq('courseId', courseId);

        if (error) {
          throw new AppError(500, 'REORDER_FAILED', 'Failed to reorder Course Materials.');
        }
      }
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('courseId', courseId)
      .order('uploadedAt', { ascending: false });

    if (refreshError) {
      throw new AppError(
        500,
        'DB_ERROR',
        'Failed to reload Course Materials after reordering.'
      );
    }

    const ordered = this._sortMaterialsForDisplay(refreshed || []);
    return Promise.all(
      ordered.map((material) => this._withEducatorAccessibleResourceUrl(material))
    );
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
    return this._sortMaterialsForDisplay(data || []);
  }

  // Educators and approved Learners open/download files through the
  // authenticated backend instead of relying on a public Storage URL.
  static async getMaterialFileForEducator(educatorId, materialId) {
    const material = await this._getMaterialAndVerifyOwnership(materialId, educatorId);
    return this._downloadMaterialFile(material);
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
    return this._downloadMaterialFile(material);
  }

  static async _downloadMaterialFile(material) {
    if (material.resourceType !== ResourceType.FILE || !material.resourceUrl) {
      throw new AppError(400, 'MATERIAL_NOT_FILE', 'This material is not a downloadable file.');
    }

    const filePath = this._getMaterialStoragePath(material.resourceUrl);
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

    if (isPdf && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }
    if (isDocx && buffer.subarray(0, 2).toString('ascii') !== 'PK') {
      throw new AppError(410, 'MATERIAL_FILE_UNAVAILABLE', 'This file is no longer available.');
    }

    const storedName = decodeURIComponent(filePath.split('/').pop() || '');
    const originalName = storedName.replace(/^\d+_/, '').trim();

    const urlPath = String(material.resourceUrl).split('?')[0];
    const extensionMatch = urlPath.match(/\.([A-Za-z0-9]+)$/);
    const extension = extensionMatch ? `.${extensionMatch[1]}` : '';
    const safeBaseName = String(material.title || 'course-material')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .trim() || 'course-material';
    const fallbackName = safeBaseName.toLowerCase().endsWith(extension.toLowerCase())
      ? safeBaseName
      : `${safeBaseName}${extension}`;

    return {
      buffer,
      mimeType: material.fileType || 'application/octet-stream',
      fileName: originalName || fallbackName,
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

  static _sortMaterialsForDisplay(materials) {
    return [...(materials || [])].sort((first, second) => {
      const firstOrder = Number(first?.orderIndex);
      const secondOrder = Number(second?.orderIndex);
      const firstHasOrder = Number.isFinite(firstOrder) && firstOrder > 0;
      const secondHasOrder = Number.isFinite(secondOrder) && secondOrder > 0;

      if (firstHasOrder && secondHasOrder) return firstOrder - secondOrder;
      if (firstHasOrder) return -1;
      if (secondHasOrder) return 1;

      const firstTime = new Date(first?.uploadedAt || 0).getTime();
      const secondTime = new Date(second?.uploadedAt || 0).getTime();
      return secondTime - firstTime;
    });
  }

  static _getMaterialStoragePath(resourceUrl) {
    const rawUrl = String(resourceUrl || '').trim();
    if (!rawUrl) return '';

    try {
      if (/^https?:\/\//i.test(rawUrl)) {
        const parsedUrl = new URL(rawUrl);
        const decodedPath = decodeURIComponent(parsedUrl.pathname);
        const marker = `/${BUCKET_MATERIALS}/`;
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
      const bucketPrefix = `${BUCKET_MATERIALS}/`;

      if (filePath.startsWith(bucketPrefix)) {
        filePath = filePath.slice(bucketPrefix.length);
      }

      return filePath.replace(/^\/+/, '').trim();
    } catch (_) {
      return '';
    }
  }

  static async _withEducatorAccessibleResourceUrl(material) {
    if (
      !material ||
      material.resourceType !== ResourceType.FILE ||
      !material.resourceUrl
    ) {
      return material;
    }

    const filePath = this._getMaterialStoragePath(material.resourceUrl);

    if (!filePath) {
      return material;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_MATERIALS)
      .createSignedUrl(filePath, 60 * 60);

    if (error || !data?.signedUrl) {
      console.error(
        '[Course Material Signed URL Error]:',
        error || 'Signed URL was not returned.'
      );
      return material;
    }

    return {
      ...material,
      resourceUrl: data.signedUrl
    };
  }

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