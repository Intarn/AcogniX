const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');

class CommunityService {
  // UC-20: View post list
  static async getPosts() {
    const { data, error } = await supabase
      .from('CommunityPost')
      .select('postId, content, createdAt, User(displayName, role)')
      .order('createdAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch community posts.');

    // Map data to match Frontend
    return (data || []).map(post => ({
      id: post.postId,
      content: post.content,
      author: post.User?.displayName || 'Unknown',
      role: post.User?.role || 'USER',
      time: new Date(post.createdAt).toLocaleDateString()
    }));
  }

  // UC-20: Create new post
  static async createPost(userId, content) {
    if (!content || !content.trim()) {
      throw new AppError(400, 'INVALID_CONTENT', 'Post content cannot be empty.');
    }

    const { data, error } = await supabase
      .from('CommunityPost')
      .insert([{ userId, content: content.trim() }])
      .select()
      .single();

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to create post.');
    return data;
  }

  // UC-20: Admin gets list of reported posts
  static async getReportedPosts() {
    const { data, error } = await supabase
      .from('CommunityReport')
      .select('reportId, reason, status, CommunityPost(postId, content, User(displayName))')
      .eq('status', 'PENDING')
      .order('createdAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch reports.');

    return (data || []).map(report => ({
      id: report.reportId,
      postId: report.CommunityPost?.postId,
      author: report.CommunityPost?.User?.displayName || 'Unknown',
      content: report.CommunityPost?.content,
      reason: report.reason
    }));
  }

  // UC-20: Admin resolves report
  static async resolveReport(reportId, action) {
    const { data: report, error: findError } = await supabase
      .from('CommunityReport')
      .select('postId')
      .eq('reportId', reportId)
      .single();

    if (findError || !report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');

    if (action === 'DELETE') {
      // Delete post (Database automatically cascades to delete report)
      const { error: deleteError } = await supabase
        .from('CommunityPost')
        .delete()
        .eq('postId', report.postId);
      if (deleteError) throw new AppError(500, 'DB_ERROR', 'Failed to delete post.');
    } else if (action === 'IGNORE') {
      // Ignore report
      const { error: updateError } = await supabase
        .from('CommunityReport')
        .update({ status: 'IGNORED' })
        .eq('reportId', reportId);
      if (updateError) throw new AppError(500, 'DB_ERROR', 'Failed to ignore report.');
    } else {
      throw new AppError(400, 'INVALID_ACTION', 'Action must be DELETE or IGNORE.');
    }

    return true;
  }
}

module.exports = CommunityService;