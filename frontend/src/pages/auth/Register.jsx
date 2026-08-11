// frontend/src/pages/auth/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const LogoAcognix = () => (
  <div className="flex items-center justify-center gap-2.5 mb-4">
    <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-leg" x1="50" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B3DFF" />
          <stop offset="100%" stopColor="#6B21FF" />
        </linearGradient>
        <linearGradient id="grad-left" x1="20" y1="85" x2="35" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00A3FF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="grad-swoosh" x1="25" y1="70" x2="95" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6B21FF" />
        </linearGradient>
      </defs>
      <path d="M 33 55 L 46 25 C 47.5 21.5 52.5 21.5 54 25 L 76 76" stroke="url(#grad-leg)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 22 80 L 26 70" stroke="url(#grad-left)" strokeWidth="14" strokeLinecap="round" />
      <path d="M 26 65 C 50 78 70 70 92 48 C 65 68 45 74 24 73 Z" fill="url(#grad-swoosh)" />
    </svg>
    <span className="text-3xl font-black text-slate-900 tracking-tight">AcogniX</span>
  </div>
);

export default function Register() {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Learner');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Gửi tham số chuẩn thứ tự: (email, password, displayName, role)
    const result = await register(email, password, fullname, role);
    
    if (result.success) {
      if (result.role === 'educator' || result.role === 'teacher') {
        navigate('/teacher-dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  return (
    <>
      <div className="mb-8 text-center">
        <LogoAcognix />
        <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
        <p className="text-sm text-gray-500 mt-1">Join AcogniX to start your AI-powered learning journey.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullname" className="text-sm font-semibold text-gray-700">Full Name</label>
            <input 
              type="text" id="fullname" required
              value={fullname} onChange={(e) => setFullname(e.target.value)}
              placeholder="An Nguyen"
              className="mt-1 w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-200 focus:border-blue-400"
            />
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</label>
            <input 
              type="email" id="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-200 focus:border-blue-400"
            />
          </div>

          {/* Ô nhập Password */}
          <div>
            <label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</label>
            <input 
              type="password" id="password" required minLength="6"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-200 focus:border-blue-400"
            />
          </div>

          {/* Khớp giá trị với Backend AuthEnums */}
          <div>
            <label htmlFor="role" className="text-sm font-semibold text-gray-700">I am a...</label>
            <select 
              id="role" required
              value={role} onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-200 focus:border-blue-400"
            >
              <option value="Learner">Student (Learner)</option>
              <option value="Educator">Teacher (Educator)</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account? <Link to="/auth/login" className="font-semibold text-blue-600 hover:underline">Log in</Link>
      </p>
    </>
  );
}