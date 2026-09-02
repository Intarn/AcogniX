import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setReady(Boolean(data?.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) setReady(true);
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password || password.length < 8) {
      showToast('Password must contain at least 8 characters.', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Password and Confirm Password do not match.', 'warning');
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      showToast('Your password has been updated. Please log in with the new password.', 'success');
      navigate('/auth/login', { replace: true });
    } catch (error) {
      showToast(error?.message || 'Unable to update password. Please request a new recovery link.', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-gray-100">
        <h1 className="text-2xl font-black text-gray-800">Set New Password</h1>
        {!ready ? (
          <div className="mt-5 text-sm text-gray-500">This recovery link is invalid or has expired. <Link to="/auth/login" className="text-blue-600 font-bold">Return to Log In</Link></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none bg-gray-50/50 focus:border-blue-500" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none bg-gray-50/50 focus:border-blue-500" />
            <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white font-bold text-xs py-3 rounded-xl disabled:opacity-50">{submitting ? 'Updating...' : 'Update Password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
