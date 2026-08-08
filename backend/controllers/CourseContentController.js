const CourseContentService = require('../service/CourseContentService');
const { UserRole } = require('../enums/AuthEnums');

class CourseContentController {
  static async uploadMaterial(req, res) {
    try {
      const educatorId = req.user.userId;
      const { courseId } = req.params;
      const { title, description, resourceType, linkUrl } = req.body;
      const file = req.file;

      const material = await CourseContentService.addMaterial(educatorId, courseId, title, description, resourceType, file, linkUrl);
      return res.status(201).json({ message: "Material uploaded successfully.", material });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  }

  static async updateMaterial(req, res) {
    try {
      const educatorId = req.user.userId;
      const { materialId } = req.params;
      const { title, description, resourceType, linkUrl } = req.body;
      const file = req.file; // Captured new file from multer

      // Encapsulate update data
      const updates = { title, description, resourceType, linkUrl };
    
      // Pass the new file to the service to replace the old one in Supabase Storage if provided
      const material = await CourseContentService.updateMaterial(educatorId, materialId, updates, files);
      return res.status(200).json({ message: "Material updated successfully.", material });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  }

  static async deleteMaterial(req, res) {
    try {
      const educatorId = req.user.userId;
      const { materialId } = req.params;

      await CourseContentService.deleteMaterial(educatorId, materialId);
      return res.status(200).json({ message: "Material deleted successfully from class and synchronized workspaces." });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  }

  static async getMaterials(req, res) {
    try {
      const { courseId } = req.params;
      const materials = await CourseContentService.getMaterialsForLearner(req.user.userId, courseId);
      
      // UC-16 Alt Flow 1 handled seamlessly (returns empty array if none)
      return res.status(200).json({ materials });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  }

  static async postAnnouncement(req, res) {
    try {
      const educatorId = req.user.userId;
      const { courseId } = req.params;
      const { title, body } = req.body;
      const files = req.files; // multiple files

      const result = await CourseContentService.publishAnnouncement(educatorId, courseId, title, body, files);

      // UC-17 Alt Flow 3: Email Service Failure
      if (result.emailFailed) {
        return res.status(201).json({ 
          message: "The announcement was posted successfully, but email notifications could not be sent at this time due to a server issue.", 
          announcement: result.announcement 
        });
      }

      return res.status(201).json({ message: "Announcement posted successfully.", announcement: result.announcement });
    } catch (error) {
      const status = error.statusCode || 500;
      // UC-17 Alt Flow 1: Missing Required Fields is naturally handled here (400 Bad Request)
      return res.status(status).json({ message: error.message });
    }
  }

  static async getAnnouncements(req, res) {
    try {
      const { courseId } = req.params;
      const announcements = await CourseContentService.getAnnouncementsForLearner(req.user.userId, courseId);
      
      // UC-16 Alt Flow 1: Return empty array, Frontend displays "No announcement yet"
      return res.status(200).json({ announcements });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  }
}

module.exports = CourseContentController;