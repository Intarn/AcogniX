// frontend/src/layouts/LearnerLayout.jsx
import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

export default function LearnerLayout() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      if (!user?.email) return;

      try {
        // Truy vấn bảng 'User' trên Supabase khớp với email đang đăng nhập
        const { data, error } = await supabase
          .from('User')
          .select('displayName')
          .eq('email', user.email)
          .single();

        if (data && data.displayName) {
          setDisplayName(data.displayName);
        } else {
          // Fallback nếu không tìm thấy trong bảng User
          setDisplayName(user.user_metadata?.fullname || user.email.split('@')[0]);
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin profile:', err);
        setDisplayName(user.email.split('@')[0]);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchUserProfile();
  }, [user]);

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Đang đợi load tên từ bảng User
  if (loadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const userInfo = {
    fullname: displayName,
    role: user.role || user.user_metadata?.role || 'learner',
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <Sidebar user={userInfo} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar user={userInfo} />
        <Outlet context={{ user }} /> 
      </div>
    </div>
  );
}