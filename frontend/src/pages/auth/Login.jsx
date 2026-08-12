import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogoAcognix } from './Register';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      setError('');
      setIsLoading(true);


      const result =
        await login(
          email,
          password
        );


      if (
        result.success
      ) {
        if (
          !result.redirectTo
        ) {
          setError(
            'Login succeeded but no redirect route was returned.'
          );

          setIsLoading(false);
          return;
        }


  navigate(
    result.redirectTo
  );
}


      setIsLoading(false);
    };

  return (
    <>
      <div className="mb-8 text-center">
        <LogoAcognix />
        <h1 className="text-2xl font-bold text-gray-900">Welcome Back!</h1>
        <p className="text-sm text-gray-500 mt-1">Log in to continue your AI-powered learning journey.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</label>
            <input 
              type="email" id="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-200 focus:border-blue-400"
            />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</label>
              <Link to="#" className="text-xs font-semibold text-blue-600 hover:underline">Forgot password?</Link>
            </div>
            <input 
              type="password" id="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-200 focus:border-blue-400"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all"
          >
            {isLoading ? 'Logging In...' : 'Log In'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don't have an account? <Link to="/auth/register" className="font-semibold text-blue-600 hover:underline">Sign up</Link>
      </p>
    </>
  );
}