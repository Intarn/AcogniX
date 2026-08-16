// frontend/src/layouts/LearnerLayout.jsx
import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

export default function LearnerLayout() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: '',
    avatarUrl: ''
  });
  const [loadingProfile, setLoadingProfile] = useState(true);

  // EFFECT 1: FETCH PROFILE & AVATAR FROM SUPABASE
  useEffect(() => {
    async function fetchUserProfile() {
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      const uid = user.userId || user.id;
      const email = user.email;

      try {
        let query = supabase.from('User').select('displayName, avatarUrl, role');

        if (uid) {
          query = query.eq('userId', uid);
        } else if (email) {
          query = query.eq('email', email.trim().toLowerCase());
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile({
            displayName: data.displayName || user.displayName || user.email.split('@')[0],
            avatarUrl: data.avatarUrl || user.avatarUrl || ''
          });
        } else {
          setProfile({
            displayName: user.displayName || user.user_metadata?.fullname || user.email.split('@')[0],
            avatarUrl: user.avatarUrl || user.user_metadata?.avatar_url || ''
          });
        }
      } catch (err) {
        console.error('[LearnerLayout] Error loading profile info:', err);
        setProfile({
          displayName: user.displayName || user.email?.split('@')[0] || 'Learner',
          avatarUrl: user.avatarUrl || ''
        });
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchUserProfile();
  }, [user?.userId, user?.id, user?.email, user?.avatarUrl, user?.displayName]);

  // UC03 tracking is intentionally scoped to the active AI Project in AIWorkspace.

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (loadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const userInfo = {
    userId: user.userId || user.id,
    email: user.email,
    fullname: profile.displayName || user.displayName || user.email.split('@')[0],
    displayName: profile.displayName || user.displayName || user.email.split('@')[0],
    avatarUrl: profile.avatarUrl || user.avatarUrl || null,
    role: user.role || 'LEARNER'
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <Sidebar user={userInfo} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar user={userInfo} />
        <main className="flex-1 flex overflow-hidden">
          <Outlet context={{ user: userInfo }} />
        </main>
      </div>
    </div>
  );
}