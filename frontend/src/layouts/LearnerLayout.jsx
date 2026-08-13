import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { pingStudySession } from '../services/analyticsService';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

export default function LearnerLayout() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  // EFFECT 1: FETCH PROFILE INFORMATION
  useEffect(() => {
    async function fetchUserProfile() {
      if (!user?.email) return;

      try {
        // Query the 'User' table on Supabase matching the logged-in email
        const { data, error } = await supabase
          .from('User')
          .select('displayName')
          .eq('email', user.email)
          .single();

        if (data && data.displayName) {
          setDisplayName(data.displayName);
        } else {
          // Fallback if not found in the User table
          setDisplayName(user.user_metadata?.fullname || user.email.split('@')[0]);
        }
      } catch (err) {
        console.error('Error loading profile info:', err);
        setDisplayName(user.email.split('@')[0]);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchUserProfile();
  }, [user]);

  // EFFECT 2: TRACK ACTIVE STUDY TIME (UC-03)
  useEffect(() => {
    // Only start tracking if the user is logged in
    if (!user) return;

    // Send the initial ping as soon as entering the system
    pingStudySession().catch(err => console.error("Ping error:", err));

    // Set up a background ping interval every 60 seconds (60000ms)
    const interval = setInterval(() => {
      pingStudySession().catch(err => console.error("Ping error:", err));
    }, 60000);

    // Cleanup (clear) this interval when the user logs out or leaves the layout
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Waiting to load name from the User table
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