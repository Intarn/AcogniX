import { useState, useEffect } from 'react';
import { getPosts, createPost } from '../../features/community/communityApi';

export default function CommunityPage() {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await getPosts();
      // Chuẩn hóa dữ liệu bài viết (thêm mock likes/comments nếu backend chưa trả về đủ)
      const formattedPosts = (response.posts || []).map(p => ({
        ...p,
        likes: p.likes || 0,
        isLiked: p.isLiked || false,
        comments: p.comments || []
      }));
      setPosts(formattedPosts);
    } catch (error) {
      console.error('Không thể tải bài viết:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newPostContent.trim()) return;
    try {
      await createPost(newPostContent);
      setNewPostContent('');
      fetchPosts();
    } catch (error) {
      alert('Đăng bài thất bại: ' + error.message);
    }
  };

  const handleLike = (postId) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          isLiked: !post.isLiked
        };
      }
      return post;
    }));
  };

  const handleAddComment = (postId) => {
    if (!commentInput.trim()) return;
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...post.comments, { id: Date.now(), author: 'Bạn', content: commentInput.trim(), time: 'Vừa xong' }]
        };
      }
      return post;
    }));
    setCommentInput('');
  };

  const handleReport = (postId) => {
    const reason = prompt("Nhập lý do báo cáo bài viết này:");
    if (reason) {
      alert("Đã gửi báo cáo vi phạm tới Quản trị viên. Cảm ơn phản hồi của bạn!");
    }
  };

  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header & Search */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-800">Community Q&A</h1>
          <p className="text-[11px] text-gray-400">Thảo luận, chia sẻ tài liệu và giải đáp thắc mắc cùng cộng đồng</p>
        </div>
        <div className="w-72">
          <input
            type="text"
            placeholder="Tìm kiếm bài viết, tác giả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
          />
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
        {/* Create Post Box */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <textarea 
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            className="w-full bg-gray-50 rounded-xl p-3 text-xs outline-none resize-none border border-gray-200 focus:border-blue-500 leading-relaxed"
            rows="3"
            placeholder="Chia sẻ tài liệu học tập hoặc đặt câu hỏi cho cộng đồng..."
          ></textarea>
          <div className="flex justify-end mt-3">
            <button 
              onClick={handlePost} 
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              Đăng bài
            </button>
          </div>
        </div>

        {/* Feed List */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 text-xs py-10">Đang tải bảng tin cộng đồng...</p>
          ) : filteredPosts.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-10">Không tìm thấy bài viết nào phù hợp.</p>
          ) : (
            filteredPosts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                {/* Author Info & Report */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&color=fff&background=3b82f6`} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="Avatar" />
                    <div>
                      <h3 className="text-xs font-bold text-gray-800">{post.author}</h3>
                      <p className="text-[10px] text-gray-400">{post.role || 'Học viên'} • {post.time || 'Vừa xong'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleReport(post.id)}
                    className="text-[10px] text-gray-400 hover:text-red-600 font-semibold transition-colors"
                    title="Báo cáo vi phạm"
                  >
                    🚩 Báo cáo
                  </button>
                </div>

                {/* Content */}
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                {/* Actions Bar (Like & Comment Toggle) */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-50 text-xs font-bold">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${post.isLiked ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span>{post.isLiked ? '❤️' : '🤍'}</span>
                    <span>{post.likes} Thích</span>
                  </button>
                  <button 
                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <span>💬</span>
                    <span>{post.comments.length} Bình luận</span>
                  </button>
                </div>

                {/* Comments Section */}
                {activeCommentPostId === post.id && (
                  <div className="mt-2 pt-3 border-t border-gray-100 space-y-3 bg-gray-50/50 p-4 rounded-xl">
                    <div className="space-y-2">
                      {post.comments.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>
                      ) : (
                        post.comments.map(c => (
                          <div key={c.id} className="bg-white p-3 rounded-xl border border-gray-100 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-gray-800">{c.author}</span>
                              <span className="text-[10px] text-gray-400">{c.time}</span>
                            </div>
                            <p className="text-gray-600">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input Thêm Bình Luận */}
                    <div className="flex gap-2 mt-3">
                      <input 
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                        placeholder="Viết bình luận của bạn..."
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500"
                      />
                      <button 
                        onClick={() => handleAddComment(post.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}