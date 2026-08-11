// frontend/src/features/community/communityApi.js
import { apiRequest } from '../../services/apiClient';

// Đổi thành true khi Backend đã sẵn sàng API thực tế
const USE_REAL_API = false;

const MOCK_STORAGE_KEY = 'acognix_community_posts';
const MOCK_REPORTS_KEY = 'acognix_community_reports';

const getInitialPosts = () => [
  {
    id: '1',
    author: 'Nguyễn Văn A',
    role: 'Learner',
    time: '2 giờ trước',
    content: 'Chào mọi người, ai có tài liệu ôn tập môn Machine Learning chia sẻ giúp mình với nhé!'
  },
  {
    id: '2',
    author: 'Trần Thị B',
    role: 'Educator',
    time: '5 giờ trước',
    content: 'Giảng viên đã cập nhật slide chương 3 lên hệ thống Workspace, các bạn nhớ check nhé.'
  }
];

// --- APIs FOR STUDENT / EDUCATOR ---
export async function getPosts() {
  if (USE_REAL_API) {
    return await apiRequest('/community/posts', { method: 'GET' });
  }
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!stored) {
    const initial = getInitialPosts();
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
    return { posts: initial };
  }
  return { posts: JSON.parse(stored) };
}

export async function createPost(content) {
  if (USE_REAL_API) {
    return await apiRequest('/community/posts', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  const posts = stored ? JSON.parse(stored) : getInitialPosts();
  
  const newPost = {
    id: Date.now().toString(),
    author: 'Thành viên hệ thống',
    role: 'User',
    time: 'Vừa xong',
    content: content
  };

  const updatedPosts = [newPost, ...posts];
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(updatedPosts));
  return { success: true, post: newPost };
}

// --- APIs FOR ADMIN MODERATION (BẮT BUỘC CÓ EXPORT) ---
export async function getReportedPosts() {
  if (USE_REAL_API) {
    return await apiRequest('/admin/community/reports', { method: 'GET' }); //[cite: 4]
  }
  const stored = localStorage.getItem(MOCK_REPORTS_KEY);
  return { reports: stored ? JSON.parse(stored) : [] };
}

export async function resolveReport(reportId, action) {
  if (USE_REAL_API) {
    return await apiRequest(`/admin/community/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action }) //[cite: 4]
    });
  }
  return { success: true };
}