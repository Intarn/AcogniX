// frontend/src/pages/shared/CommunityPage.jsx
import { useState, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';

// Danh sách các Cảm xúc hỗ trợ
const REACTION_TYPES = [
  { type: 'LIKE', label: 'Thích', emoji: '👍', color: 'text-blue-600', bg: 'bg-blue-50' },
  { type: 'LOVE', label: 'Yêu thích', emoji: '❤️', color: 'text-red-500', bg: 'bg-red-50' },
  { type: 'HAHA', label: 'Cười haha', emoji: '😂', color: 'text-amber-500', bg: 'bg-amber-50' },
  { type: 'WOW', label: 'Bất ngờ', emoji: '😮', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { type: 'SAD', label: 'Buồn', emoji: '😢', color: 'text-purple-600', bg: 'bg-purple-50' },
  { type: 'ANGRY', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600', bg: 'bg-orange-50' },
];

const QUICK_EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '💡', '❓', '🚀', '📌', '🎯', '📚'];

export default function CommunityPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('CATEGORIES'); 
  const [selectedTarget, setSelectedTarget] = useState('Computer Science');
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');

  const [allCategories, setAllCategories] = useState([
    { id: 'cat-1', name: 'Computer Science', joined: true },
    { id: 'cat-2', name: 'Data Science', joined: true },
    { id: 'cat-3', name: 'Foreign Languages', joined: true },
    { id: 'cat-4', name: 'General Discussion', joined: true },
    { id: 'cat-5', name: 'Digital Marketing', joined: false },
    { id: 'cat-6', name: 'UI/UX Design', joined: false },
  ]);

  const [privateGroups] = useState([
    { id: 'g-1', name: 'Đồ án Web K24' },
    { id: 'g-2', name: 'Nhóm Nghiên cứu AI' },
    { id: 'g-3', name: 'Luyện thi IELTS' },
  ]);

  const [showExploreModal, setShowExploreModal] = useState(false);
  const [exploreSearch, setExploreSearch] = useState('');

  const isImageFile = (fileNameOrUrl) => {
    if (!fileNameOrUrl) return false;
    if (typeof fileNameOrUrl === 'object' && fileNameOrUrl.type) {
      return fileNameOrUrl.type.startsWith('image/');
    }
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(String(fileNameOrUrl));
  };

  // UC-19 Q&A
  const [qaContent, setQaContent] = useState('');
  const [qaAttachment, setQaAttachment] = useState(null);
  const qaFileInputRef = useRef(null);

  // UC-18 Share Resources
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSource, setShareSource] = useState('WORKSPACE'); 
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState('');
  const [deviceFile, setDeviceFile] = useState(null);
  const [shareDescription, setShareDescription] = useState('');
  const deviceFileInputRef = useRef(null);

  const workspaceFiles = [
    { id: 'f1', name: 'Machine_Learning_Chap1.pdf', type: 'doc' },
    { id: 'f2', name: 'So_Do_Kien_Truc_System.png', type: 'image', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600' }
  ];

  // Feed bài đăng
  const [feed, setFeed] = useState([
    {
      id: 1,
      author: 'Nguyễn Trần D',
      role: 'Educator',
      target: 'Computer Science',
      content: 'Thầy vừa tải lên bộ sơ đồ kiến trúc hệ thống để các bạn làm đồ án tham khảo nhé! 🔥 Mọi người có thể xem ảnh minh họa ở bên dưới.',
      type: 'RESOURCE',
      attachment: {
        name: 'So_Do_Kien_Truc_System.png',
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
        isImage: true
      },
      userReaction: 'LIKE',
      reactions: { LIKE: 10, LOVE: 3, HAHA: 1 },
      comments: [{ id: 'c1', author: 'Lê Văn B', content: 'Sơ đồ rất rõ ràng, cảm ơn thầy ạ! 🎉' }]
    },
    {
      id: 2,
      author: 'Trần Đăng Khoa',
      role: 'Learner',
      target: 'Computer Science',
      content: 'Mọi người cho mình hỏi bài tập thuật toán đồ thị trong tệp này giải theo hướng Dijkstra đúng không ạ? ❓',
      type: 'QA',
      attachment: {
        name: 'Baitap_ThuatToan_Dothi.pdf',
        url: null,
        isImage: false
      },
      userReaction: null,
      reactions: { LIKE: 2, WOW: 1 },
      comments: []
    }
  ]);

  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  
  // State quản lý Popup Reaction
  const [hoveredReactionPostId, setHoveredReactionPostId] = useState(null);

  // XỬ LÝ PHẢN ỨNG (REACTION)
  const handleReaction = (postId, reactionType) => {
    setFeed(prev => prev.map(post => {
      if (post.id !== postId) return post;

      const currentReaction = post.userReaction;
      const updatedReactions = { ...(post.reactions || {}) };
      let nextUserReaction = reactionType;

      if (currentReaction === reactionType) {
        nextUserReaction = null;
        updatedReactions[reactionType] = Math.max(0, (updatedReactions[reactionType] || 1) - 1);
      } else {
        if (currentReaction) {
          updatedReactions[currentReaction] = Math.max(0, (updatedReactions[currentReaction] || 1) - 1);
        }
        updatedReactions[reactionType] = (updatedReactions[reactionType] || 0) + 1;
      }

      return {
        ...post,
        userReaction: nextUserReaction,
        reactions: updatedReactions
      };
    }));
    setHoveredReactionPostId(null);
  };

  const getTotalReactionsCount = (reactionsObj = {}) => Object.values(reactionsObj).reduce((sum, count) => sum + count, 0);
  const getTopReactionEmojis = (reactionsObj = {}) => Object.entries(reactionsObj).filter(([_, count]) => count > 0).map(([type]) => REACTION_TYPES.find(r => r.type === type)?.emoji).filter(Boolean).slice(0, 3);
  const appendEmoji = (emoji, setter) => setter(prev => prev + emoji);

  // ĐĂNG BÀI Q&A
  const handleQaFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Kích thước tệp vượt quá giới hạn 10 MB.', 'error');
      if (qaFileInputRef.current) qaFileInputRef.current.value = null;
      return;
    }
    const isImg = isImageFile(file);
    setQaAttachment({ file, name: file.name, url: isImg ? URL.createObjectURL(file) : null, isImage: isImg });
  };

  const handlePostQA = (e) => {
    e.preventDefault();
    if (!qaContent.trim() && !qaAttachment) return showToast('Nội dung câu hỏi hoặc tệp đính kèm không được để trống.', 'warning');
    
    const newPost = {
      id: Date.now(),
      author: 'Bạn',
      role: 'Learner',
      target: selectedTarget,
      content: qaContent,
      type: 'QA',
      attachment: qaAttachment ? { name: qaAttachment.name, url: qaAttachment.url, isImage: qaAttachment.isImage } : null,
      userReaction: null,
      reactions: {},
      comments: []
    };

    setFeed([newPost, ...feed]);
    setQaContent('');
    setQaAttachment(null);
    if (qaFileInputRef.current) qaFileInputRef.current.value = null;
    showToast('Đã đăng câu hỏi thảo luận! 🎉', 'success');
  };

  // SHARE RESOURCE
  const handleDeviceFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast('File vượt quá giới hạn 50MB cho phép.', 'error');
      if (deviceFileInputRef.current) deviceFileInputRef.current.value = null;
      return;
    }
    const isImg = isImageFile(file);
    setDeviceFile({ file, name: file.name, url: isImg ? URL.createObjectURL(file) : null, isImage: isImg });
  };

  const handleShareResource = (e) => {
    e.preventDefault();
    if (!shareDescription.trim()) return showToast('Vui lòng nhập mô tả cho tài nguyên bạn chia sẻ.', 'warning');

    let attachmentObj = null;
    if (shareSource === 'WORKSPACE') {
      if (!selectedWorkspaceFile) return showToast('Vui lòng chọn file từ Workspace.', 'warning');
      const foundFile = workspaceFiles.find(f => f.id === selectedWorkspaceFile);
      attachmentObj = { name: foundFile.name, url: foundFile.url || null, isImage: isImageFile(foundFile.name) };
    } else {
      if (!deviceFile) return showToast('Vui lòng chọn file từ thiết bị.', 'warning');
      attachmentObj = { name: deviceFile.name, url: deviceFile.url, isImage: deviceFile.isImage };
    }

    const newPost = {
      id: Date.now(),
      author: 'Bạn',
      role: 'Learner',
      target: selectedTarget,
      content: shareDescription,
      type: 'RESOURCE',
      attachment: attachmentObj,
      userReaction: null,
      reactions: {},
      comments: []
    };

    setFeed([newPost, ...feed]);
    setIsShareModalOpen(false);
    setSelectedWorkspaceFile('');
    setDeviceFile(null);
    setShareDescription('');
    showToast('Đã chia sẻ tài nguyên thành công! 🚀', 'success');
  };

  const handleComment = (postId) => {
    if (!commentInput.trim()) return;
    setFeed(prev => prev.map(post => post.id === postId ? { ...post, comments: [...post.comments, { id: Date.now(), author: 'Bạn', content: commentInput }] } : post));
    setCommentInput('');
  };

  const toggleJoinCategory = (catId) => {
    setAllCategories(prev => prev.map(cat => {
      if (cat.id === catId) {
        const nextState = !cat.joined;
        showToast(nextState ? `Đã tham gia chủ đề "${cat.name}"` : `Đã rời khỏi chủ đề "${cat.name}"`, 'info');
        return { ...cat, joined: nextState };
      }
      return cat;
    }));
  };

  const joinedCategories = allCategories.filter(cat => cat.joined);
  const sidebarCategoriesFiltered = joinedCategories.filter(cat => cat.name.toLowerCase().includes(sidebarSearch.toLowerCase()));
  const sidebarGroupsFiltered = privateGroups.filter(g => g.name.toLowerCase().includes(sidebarSearch.toLowerCase()));

  const currentFeed = feed.filter(post => {
    const isRightTarget = post.target === selectedTarget;
    const matchesSearch = feedSearchQuery.trim() === '' || 
      post.content.toLowerCase().includes(feedSearchQuery.toLowerCase()) ||
      post.author.toLowerCase().includes(feedSearchQuery.toLowerCase());
    return isRightTarget && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* HEADER MAIN */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-base font-bold text-gray-800">Community & Peer-to-Peer Q&A</h1>
          <p className="text-[11px] text-gray-400">Trao đổi kiến thức, câu hỏi và tài nguyên học tập</p>
        </div>

        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input
              type="text"
              placeholder={`Tìm bài viết, tài nguyên trong ${selectedTarget}...`}
              value={feedSearchQuery}
              onChange={(e) => setFeedSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            {feedSearchQuery && (
              <button onClick={() => setFeedSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
        </div>
        
        <button onClick={() => setIsShareModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-2 flex-shrink-0">
          <span>📁</span> Share Resource
        </button>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full p-6 gap-6 overflow-hidden">
        
        {/* SIDEBAR BÊN TRÁI */}
        <aside className="w-72 bg-white rounded-2xl border border-gray-100 p-4 flex flex-col flex-shrink-0">
          <div className="flex bg-gray-100 p-1 rounded-xl mb-3">
            <button onClick={() => { setActiveTab('CATEGORIES'); if(joinedCategories[0]) setSelectedTarget(joinedCategories[0].name); }} className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${activeTab === 'CATEGORIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
              Categories ({joinedCategories.length})
            </button>
            <button onClick={() => { setActiveTab('GROUPS'); if(privateGroups[0]) setSelectedTarget(privateGroups[0].name); }} className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${activeTab === 'GROUPS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
              My Groups
            </button>
          </div>

          <div className="mb-3">
            <input type="text" placeholder={activeTab === 'CATEGORIES' ? "Tìm nhanh ngành học..." : "Tìm nhanh nhóm..."} value={sidebarSearch} onChange={(e) => setSidebarSearch(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {activeTab === 'CATEGORIES' ? (
              sidebarCategoriesFiltered.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedTarget(cat.name)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${selectedTarget === cat.name ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span className="truncate">{cat.name}</span>
                  {selectedTarget === cat.name && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                </button>
              ))
            ) : (
              sidebarGroupsFiltered.map((group) => (
                <button key={group.id} onClick={() => setSelectedTarget(group.name)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${selectedTarget === group.name ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span className="truncate">{group.name}</span>
                  {selectedTarget === group.name && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                </button>
              ))
            )}
          </div>

          {activeTab === 'CATEGORIES' && (
            <button onClick={() => setShowExploreModal(true)} className="mt-3 w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5">
              <span>🔍</span> Khám phá chủ đề khác
            </button>
          )}
        </aside>

        {/* MAIN FEED */}
        <main className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2">
          
          {/* Ô NHẬP STATUS / Q&A GỌN GÀNG HƠN */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex-shrink-0">
            <h3 className="text-xs font-bold text-gray-700 mb-2">Đăng câu hỏi trong: <span className="text-blue-600">{selectedTarget}</span></h3>
            
            {/* Box nhập liệu tích hợp */}
            <div className="border border-gray-200 bg-gray-50 rounded-xl overflow-hidden focus-within:bg-white focus-within:border-blue-400 transition-colors">
              <textarea
                value={qaContent}
                onChange={(e) => setQaContent(e.target.value)}
                rows="2"
                placeholder="Bạn đang nghĩ gì? Hoặc cần hỏi gì..."
                className="w-full bg-transparent p-3 text-xs outline-none resize-none"
              />

              {/* Bar Emoji chèn nhanh */}
              <div className="flex items-center gap-1 px-3 pb-2 flex-wrap">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => appendEmoji(emoji, setQaContent)}
                    className="w-6 h-6 rounded-lg hover:bg-blue-50 text-xs flex items-center justify-center transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Preview Ảnh đính kèm (nếu có) */}
              {qaAttachment && (
                <div className="mx-3 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-blue-800 truncate">Tệp: {qaAttachment.name}</span>
                    <button onClick={() => setQaAttachment(null)} className="text-[10px] font-bold text-red-500 hover:underline">Xóa tệp</button>
                  </div>
                  {qaAttachment.isImage && qaAttachment.url && (
                    <img src={qaAttachment.url} alt="Preview" className="max-h-32 rounded-lg object-cover border border-blue-200" />
                  )}
                </div>
              )}
            </div>

            {/* Actions đăng bài */}
            <div className="flex justify-between items-center mt-3">
              <input type="file" ref={qaFileInputRef} className="hidden" onChange={handleQaFileChange} />
              <button
                type="button"
                onClick={() => qaFileInputRef.current?.click()}
                className="text-xs font-semibold text-gray-500 hover:text-blue-600 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-50"
              >
                <span>📷</span> Đính kèm tệp (Max 10MB)
              </button>

              <button onClick={handlePostQA} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm transition-colors">
                Đăng bài
              </button>
            </div>
          </div>

          {/* DANH SÁCH FEED */}
          <div className="space-y-4">
            {currentFeed.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <p className="text-xs text-gray-500">
                  {feedSearchQuery ? `Không tìm thấy bài viết nào phù hợp với "${feedSearchQuery}".` : 'Chưa có bài đăng nào trong mục này.'}
                </p>
              </div>
            ) : (
              currentFeed.map(post => {
                const totalReactions = getTotalReactionsCount(post.reactions);
                const topEmojis = getTopReactionEmojis(post.reactions);
                const activeReactionObj = REACTION_TYPES.find(r => r.type === post.userReaction);

                return (
                  <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 relative">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ${post.type === 'RESOURCE' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                          {post.author.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-800">{post.author}</h4>
                          <p className="text-[10px] text-gray-400">{post.role} • Vừa xong</p>
                        </div>
                      </div>
                      {post.type === 'RESOURCE' && <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-md">RESOURCE SHARED</span>}
                    </div>

                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                    {post.attachment && (
                      <div className="mt-2">
                        {post.attachment.isImage ? (
                          <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-w-lg">
                            <img src={post.attachment.url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600'} alt={post.attachment.name} className="w-full h-auto max-h-80 object-cover" />
                            <div className="p-2 text-[10px] text-gray-500 bg-white border-t border-gray-100 flex justify-between items-center">
                              <span>🖼️ {post.attachment.name}</span>
                              <a href={post.attachment.url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">Xem gốc</a>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-base">📄</span>
                              <span className="text-xs font-bold text-gray-700 truncate">{post.attachment.name}</span>
                            </div>
                            <button className="text-xs text-blue-600 font-bold hover:underline flex-shrink-0 ml-3">Download</button>
                          </div>
                        )}
                      </div>
                    )}

                    {totalReactions > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
                        <div className="flex -space-x-1">
                          {topEmojis.map((emoji, i) => <span key={i} className="text-xs bg-white rounded-full px-0.5 border border-gray-100 shadow-sm">{emoji}</span>)}
                        </div>
                        <span className="font-bold">{totalReactions}</span>
                      </div>
                    )}

                    {/* VÙNG CHỨA REACTION BAR */}
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-50 text-xs font-bold relative">
                      
                      {/* VÙNG ĐỆM HOVER (CÓ PB-2 LÀM CẦU NỐI) */}
                      <div 
                        className="relative"
                        onMouseEnter={() => setHoveredReactionPostId(post.id)}
                        onMouseLeave={() => setHoveredReactionPostId(null)}
                      >
                        {hoveredReactionPostId === post.id && (
                          <div className="absolute bottom-full left-0 pb-2 z-30">
                            <div className="bg-white rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.1)] border border-gray-100 px-2 py-1.5 flex gap-1 animate-bounce">
                              {REACTION_TYPES.map(react => (
                                <button
                                  key={react.type}
                                  onClick={() => handleReaction(post.id, react.type)}
                                  className="text-xl hover:scale-150 transition-transform p-1.5 origin-bottom"
                                  title={react.label}
                                >
                                  {react.emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => handleReaction(post.id, post.userReaction || 'LIKE')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${activeReactionObj ? `${activeReactionObj.bg} ${activeReactionObj.color}` : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                          <span>{activeReactionObj ? activeReactionObj.emoji : '👍'}</span>
                          <span>{activeReactionObj ? activeReactionObj.label : 'Thích'}</span>
                        </button>
                      </div>

                      <button 
                        onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                        className="text-gray-500 hover:text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span>💬</span>
                        <span>{post.comments.length} Bình luận</span>
                      </button>
                    </div>

                    {activeCommentPostId === post.id && (
                      <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                        {post.comments.map(c => (
                          <div key={c.id} className="bg-white p-3 rounded-lg border border-gray-100">
                            <p className="text-[11px] font-bold text-gray-800">{c.author}</p>
                            <p className="text-xs text-gray-600 mt-1">{c.content}</p>
                          </div>
                        ))}
                        
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={commentInput}
                              onChange={e => setCommentInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                              placeholder="Viết bình luận của bạn..."
                              className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                            />
                            <button onClick={() => handleComment(post.id)} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">Gửi</button>
                          </div>

                          <div className="flex gap-1 overflow-x-auto py-1">
                            {QUICK_EMOJIS.slice(0, 8).map(emoji => (
                              <button key={emoji} type="button" onClick={() => appendEmoji(emoji, setCommentInput)} className="text-xs px-1.5 py-0.5 rounded bg-white hover:bg-blue-100 border border-gray-100">
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* CÁC MODAL KHÁC NHƯ CŨ (Giữ nguyên Explore & Share) */}
      {showExploreModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-gray-800">Khám phá chủ đề</h3>
              <button onClick={() => setShowExploreModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div>
              <input type="text" placeholder="Tìm tên ngành học..." value={exploreSearch} onChange={(e) => setExploreSearch(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500" />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {allCategories.filter(c => c.name.toLowerCase().includes(exploreSearch.toLowerCase())).map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold text-gray-700">{cat.name}</span>
                  <button onClick={() => toggleJoinCategory(cat.id)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${cat.joined ? 'bg-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {cat.joined ? 'Đã tham gia (Rời)' : '+ Tham gia'}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t pt-3">
              <button onClick={() => setShowExploreModal(false)} className="px-5 py-2 bg-gray-800 text-white text-xs font-bold rounded-xl">Xong</button>
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Share Study Resource</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Chia sẻ tài nguyên vào <span className="font-bold text-emerald-600">{selectedTarget}</span></p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-gray-800">✕</button>
            </div>

            <form onSubmit={handleShareResource} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả tài nguyên <span className="text-red-500">*</span></label>
                <textarea value={shareDescription} onChange={(e) => setShareDescription(e.target.value)} rows="3" required placeholder="Nhập hướng dẫn sử dụng tài nguyên này..." className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs outline-none focus:border-emerald-500 focus:bg-white resize-none" />
                <div className="flex gap-1 mt-1 overflow-x-auto">
                  {QUICK_EMOJIS.slice(0, 8).map(emoji => (
                    <button key={emoji} type="button" onClick={() => appendEmoji(emoji, setShareDescription)} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 hover:bg-emerald-100">{emoji}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Nguồn tài nguyên</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setShareSource('WORKSPACE')} className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${shareSource === 'WORKSPACE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>From AI Workspace</button>
                  <button type="button" onClick={() => setShareSource('DEVICE')} className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${shareSource === 'DEVICE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>From Device</button>
                </div>
              </div>

              {shareSource === 'WORKSPACE' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn file trong Workspace</label>
                  <select value={selectedWorkspaceFile} onChange={(e) => setSelectedWorkspaceFile(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-500">
                    <option value="" disabled>-- Chọn tệp tài nguyên --</option>
                    {workspaceFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tải file lên (Max 50MB)</label>
                  <input type="file" ref={deviceFileInputRef} onChange={handleDeviceFileChange} className="w-full text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
                  {deviceFile && (
                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 truncate">{deviceFile.name}</span>
                      {deviceFile.isImage && <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Ảnh</span>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsShareModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
                <button type="submit" className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">Share Resource</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}