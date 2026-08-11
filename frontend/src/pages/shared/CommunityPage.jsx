import { useState, useEffect } from 'react';
import { getPosts, createPost } from '../../features/community/communityApi';

export default function CommunityPage() {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch actual data on component mount
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await getPosts();
      // Update according to the actual API response structure later
      setPosts(response.posts || []); 
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newPostContent.trim()) return;
    try {
      await createPost(newPostContent);
      setNewPostContent(''); // Clear input field
      fetchPosts(); // Reload posts
    } catch (error) {
      alert('Failed to post: ' + error.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Community Q&A</h1>
      </header>
      <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
        {/* Create Post Box */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <textarea 
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            className="w-full bg-gray-50 rounded-lg p-3 text-sm outline-none resize-none border border-gray-100 focus:border-blue-300"
            rows="3"
            placeholder="Share a resource or ask a question to the community..."
          ></textarea>
          <div className="flex justify-end mt-3">
            <button onClick={handlePost} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm">
              Post
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-gray-500 text-sm">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-center text-gray-500 text-sm">No posts available yet.</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&color=fff`} className="w-10 h-10 rounded-full" alt="Avatar" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">{post.author}</h3>
                    <p className="text-[10px] text-gray-500">{post.role} • {post.time}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">{post.content}</p>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}