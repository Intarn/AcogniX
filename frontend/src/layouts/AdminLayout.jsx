import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import AdminSidebar from '../components/layout/AdminSidebar';
import Topbar from '../components/layout/Topbar';

export default function AdminLayout() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: '',
    avatarUrl: ''
  });
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      if (!user?.email) {
        setLoadingProfile(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('User')
          .select('displayName, avatarUrl')
          .eq('email', user.email)
          .single();

        if (data) {
          setProfile({
            displayName: data.displayName || 'System Admin',
            avatarUrl: data.avatarUrl || ''
          });
        } else {
          setProfile({
            displayName: user.user_metadata?.fullname || 'System Admin',
            avatarUrl: user.avatarUrl || user.user_metadata?.avatar_url || ''
          });
        }
      } catch (err) {
        console.error('Error loading profile info:', err);
        setProfile({
          displayName: 'System Admin',
          avatarUrl: ''
        });
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchUserProfile();
  }, [user]);

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (loadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const userInfo = {
    fullname: user.displayName || profile.displayName || user.user_metadata?.fullname || 'System Administrator',
    avatarUrl: user.avatarUrl || profile.avatarUrl || user.user_metadata?.avatar_url || null,
    role: user.role || user.user_metadata?.role || 'system_administrator',
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <AdminSidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar user={userInfo} />
        <Outlet context={{ user }} />
      </div>
    </div>
  );
}