// backend/controllers/CourseContentController.js
const CourseContentService = require('../service/CourseContentService');
const { UserRole } = require('../enums/AuthEnums');

/**
 * Xử lý lỗi tập trung cho CourseContentController
 */
function handleControllerError(error, res) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      code: error.code || 'ERROR',
      message: error.message
    });
  }
  console.error('[CourseContentController Error]:', error);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: error.message || 'An unexpected error occurred.'
  });
}

class CourseContentController {
  static async uploadMaterial(req, res) {
    try {
      const educatorId = req.user.userId;
      const { courseId } = req.params;
      const { title, description, resourceType, linkUrl } = req.body;
      const file = req.file;

      const material = await CourseContentService.addMaterial(
        educatorId,
        courseId,
        title,
        description,
        resourceType,
        file,
        linkUrl
      );
      return res.status(201).json({ message: 'Material uploaded successfully.', material });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async updateMaterial(req, res) {
    try {
      const educatorId = req.user.userId;
      const { materialId } = req.params;
      const { title, description, resourceType, linkUrl } = req.body;
      const file = req.file;

      const updates = { title, description, resourceType, linkUrl };
      const material = await CourseContentService.updateMaterial(educatorId, materialId, updates, file);
      return res.status(200).json({ message: 'Material updated successfully.', material });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async deleteMaterial(req, res) {
    try {
      const educatorId = req.user.userId;
      const { materialId } = req.params;
      await CourseContentService.deleteMaterial(educatorId, materialId);
      return res.status(200).json({ message: 'Material deleted successfully from class and synchronized workspaces.' });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async reorderMaterials(req, res) {
    try {
      const materials = await CourseContentService.reorderMaterials(
        req.user.userId,
        req.params.courseId,
        req.body.materialOrders
      );

      return res.status(200).json({
        message: 'Course Materials reordered successfully.',
        materials
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getMaterials(req, res) {
    try {
      const { courseId } = req.params;
      const userId = req.user.userId;
      const role = req.user.role;
      let materials;

      if (role === UserRole.EDUCATOR) {
        materials = await CourseContentService.getMaterialsForEducator(userId, courseId);
      } else if (role === UserRole.LEARNER) {
        materials = await CourseContentService.getMaterialsForLearner(userId, courseId);
      } else {
        return res.status(403).json({ message: 'You do not have permission to access this class content.' });
      }

      return res.status(200).json({ materials });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getMaterialFile(req, res) {
    try {
      const result = req.user.role === UserRole.EDUCATOR
        ? await CourseContentService.getMaterialFileForEducator(
            req.user.userId,
            req.params.materialId
          )
        : await CourseContentService.getMaterialFileForLearner(
            req.user.userId,
            req.params.materialId
          );

      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      const originalFileName = String(result.fileName || 'course-material')
        .replace(/[\r\n]/g, ' ')
        .trim() || 'course-material';
      const safeFileName = originalFileName.replace(/[^\x20-\x7E]|["]/g, '_');
      const encodedFileName = encodeURIComponent(originalFileName);

      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', result.buffer.length);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(result.buffer);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async postAnnouncement(req, res) {
    try {
      const { title, body } = req.body;
      const files = req.files;

      const result = await CourseContentService.publishAnnouncement(
        req.user.userId,
        req.params.courseId,
        title,
        body,
        files
      );
      return res.status(201).json({
        message: 'Announcement posted successfully.',
        ...result
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async getAnnouncements(req, res) {
    try {
      const { courseId } = req.params;
      const userId = req.user.userId;
      const role = req.user.role;
      let announcements;

      if (role === UserRole.EDUCATOR) {
        announcements = await CourseContentService.getAnnouncementsForEducator(userId, courseId);
      } else if (role === UserRole.LEARNER) {
        announcements = await CourseContentService.getAnnouncementsForLearner(userId, courseId);
      } else {
        return res.status(403).json({ message: 'You do not have permission to access this class content.' });
      }

      return res.status(200).json({ announcements });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async deleteAnnouncement(req, res) {
    try {
      await CourseContentService.deleteAnnouncement(req.user.userId, req.params.announcementId);
      return res.status(200).json({ message: 'Announcement deleted successfully.' });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
}

module.exports = CourseContentController;