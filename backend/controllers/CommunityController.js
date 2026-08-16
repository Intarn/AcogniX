// backend/controllers/CommunityController.js
const AppError = require('../error/AppError');

function handleControllerError(error, res) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ code: error.code || 'ERROR', message: error.message });
  }
  console.error('[CommunityController Error]:', error);
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' });
}

class CommunityController {
  // Alias tương thích với route GET /posts
  static async getFeed(req, res) {
    return CommunityController.getPosts(req, res);
  }

  static async getPosts(req, res) {
    try {
      // Trả về danh sách bài đăng cộng đồng
      return res.status(200).json({ posts: [] });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async createPost(req, res) {
    try {
      const { targetName, content, postType } = req.body;
      const file = req.file;
      const newPost = {
        id: Date.now(),
        userId: req.user.userId,
        targetName,
        content,
        postType,
        attachmentUrl: file ? file.path : null,
        createdAt: new Date().toISOString()
      };
      return res.status(201).json({ message: 'Post created successfully', post: newPost });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async reactToPost(req, res) {
    try {
      const { postId } = req.params;
      const { reactionType } = req.body;
      return res.status(200).json({ message: 'Reaction recorded successfully', postId, reactionType });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }

  static async commentOnPost(req, res) {
    try {
      const { postId } = req.params;
      const { content } = req.body;
      return res.status(201).json({
        message: 'Comment added successfully',
        comment: {
          commentId: Date.now(),
          postId,
          userId: req.user.userId,
          content,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
}

module.exports = CommunityController;