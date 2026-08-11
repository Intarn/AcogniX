const CommunityService = require('../service/CommunityService');

function handleControllerError(error, res) {
  if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
  console.error(error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
}

class CommunityController {
  static async getPosts(req, res) {
    try {
      const posts = await CommunityService.getPosts();
      return res.status(200).json({ posts });
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async createPost(req, res) {
    try {
      const post = await CommunityService.createPost(req.user.userId, req.body.content);
      return res.status(201).json({ message: 'Post created successfully', post });
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async getReports(req, res) {
    try {
      const reports = await CommunityService.getReportedPosts();
      return res.status(200).json({ reports });
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  static async resolveReport(req, res) {
    try {
      await CommunityService.resolveReport(req.params.reportId, req.body.action);
      return res.status(200).json({ message: 'Report resolved successfully' });
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}

module.exports = CommunityController;