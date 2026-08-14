// frontend/src/services/communityService.js
import { apiRequest } from './apiClient';

export const getCommunityFeed = async (target, search = '') => {
    return await apiRequest(`/community/posts?target=${encodeURIComponent(target)}&search=${encodeURIComponent(search)}`, { method: 'GET' });
};

export const createCommunityPost = async (targetName, content, postType, file) => {
    const formData = new FormData();
    formData.append('targetName', targetName);
    formData.append('content', content);
    formData.append('postType', postType);
    if (file) formData.append('attachment', file);

    return await apiRequest('/community/posts', { method: 'POST', body: formData });
};

export const toggleReactionAPI = async (postId, reactionType) => {
    return await apiRequest(`/community/posts/${postId}/reactions`, {
        method: 'PUT',
        body: JSON.stringify({ reactionType })
    });
};

export const addCommentAPI = async (postId, content) => {
    return await apiRequest(`/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
    });
};