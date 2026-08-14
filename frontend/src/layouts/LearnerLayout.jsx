// frontend/src/layouts/LearnerLayout.jsx
import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { pingStudySession } from '../services/analyticsService';
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
      if (!user?.email) {
        setLoadingProfile(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('User')
          .select('displayName, avatarUrl')
          .eq('email', user.email)
          .single();

        if (data) {
          setProfile({
            displayName: data.displayName || '',
            avatarUrl: data.avatarUrl || ''
          });
        } else {
          setProfile({
            displayName: user.user_metadata?.fullname || user.email.split('@')[0],
            avatarUrl: user.avatarUrl || user.user_metadata?.avatar_url || ''
          });
        }
      } catch (err) {
        console.error('Error loading profile info:', err);
        setProfile({
          displayName: user.email.split('@')[0],
          avatarUrl: ''
        });
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchUserProfile();
  }, [user]);

  // EFFECT 2: TRACK ACTIVE STUDY TIME (UC-03)
  useEffect(() => {
    if (!user) return;

    pingStudySession().catch((err) => console.error('Ping error:', err));

    const interval = setInterval(() => {
      pingStudySession().catch((err) => console.error('Ping error:', err));
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

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
    fullname:
      user.displayName ||
      profile.displayName ||
      user.user_metadata?.fullname ||
      user.email.split('@')[0],
    avatarUrl:
      user.avatarUrl ||
      profile.avatarUrl ||
      user.user_metadata?.avatar_url ||
      null,
    role: user.role || user.user_metadata?.role || 'learner'
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans overflow-hidden text-gray-800">
      <Sidebar user={userInfo} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar đã được nhúng NotificationPopover bên trong */}
        <Topbar user={userInfo} />
        <Outlet context={{ user }} />
      </div>
    </div>
  );
}