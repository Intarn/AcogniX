// frontend/src/pages/auth/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { forgotPassword } from '../../features/auth/authApi';

const EMPTY_ERRORS = {
  email: false,
  password: false
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast, clearToasts } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const validateEmail = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const getLoginErrorMessage = (result) => {
    if (result?.code === 'BANNED_ACCOUNT' || result?.status === 403) {
      return 'Your account has been banned. Please contact the System Administrator for assistance.';
    }

    if (result?.code === 'INVALID_CREDENTIALS' || result?.status === 401) {
      return 'Incorrect email or password.';
    }

    if (result?.code === 'SESSION_CREATION_FAILED' || result?.status >= 500) {
      return 'Unable to log in at this time. Please try again.';
    }

    return result?.error || 'Unable to log in at this time. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearToasts();

    const cleanEmail = email.trim();
    // Do not trim passwords: spaces can be valid password characters.
    const cleanPassword = password;

    const missingEmail = !cleanEmail;
    const missingPassword = !cleanPassword;

    if (missingEmail || missingPassword) {
      setFieldErrors({
        email: missingEmail,
        password: missingPassword
      });
      showToast('Please enter your email and password.', 'warning');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setFieldErrors({ email: true, password: false });
      showToast('Please enter a valid email address.', 'warning');
      return;
    }

    setFieldErrors(EMPTY_ERRORS);

    try {
      setSubmitting(true);

      const result = await login(cleanEmail, cleanPassword);

      if (!result?.success) {
        if (result?.code === 'INVALID_CREDENTIALS' || result?.status === 401) {
          // UC21-UI05/UI06: clear the password after invalid credentials.
          setPassword('');
          setFieldErrors({ email: false, password: true });
        }

        showToast(getLoginErrorMessage(result), 'error');
        return;
      }

      showToast('Login successful!', 'success');

      const role = String(result.userRole || result.role || '').toUpperCase();

      if (role === 'SYSTEM_ADMINISTRATOR') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'EDUCATOR') {
        navigate('/educator/dashboard', { replace: true });
      } else if (role === 'LEARNER') {
        navigate('/learner/dashboard', { replace: true });
      } else {
        // A successful authentication without a valid role must not grant
        // access to an arbitrary dashboard.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentUser');
        showToast('Unable to log in at this time. Please try again.', 'error');
        navigate('/auth/login', { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };


  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim();

    if (!cleanEmail) {
      showToast('Please enter your email address.', 'warning');
      return;
    }
    if (!validateEmail(cleanEmail)) {
      showToast('Please enter a valid email address.', 'warning');
      return;
    }

    try {
      setForgotSubmitting(true);
      const response = await forgotPassword(cleanEmail);
      showToast(response?.message || 'If an account exists for this email, a new temporary password has been sent to that email address.', 'success');
      setForgotOpen(false);
      setForgotEmail('');
    } catch (error) {
      showToast(error?.message || 'Unable to reset the password right now. Please try again.', 'error');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const inputClass = (hasError) =>
    `w-full text-xs border rounded-xl p-3 outline-none bg-gray-50/50 ${
      hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-200 focus:border-blue-500'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-800">Welcome Back!</h1>
          <p className="text-xs text-gray-400 mt-1">
            Log in to continue your smart learning space with AI
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: false }));
                }
              }}
              placeholder="student@acognix.com"
              aria-invalid={fieldErrors.email}
              className={inputClass(fieldErrors.email)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: false }));
                }
              }}
              placeholder="••••••••"
              aria-invalid={fieldErrors.password}
              className={inputClass(fieldErrors.password)}
            />
          </div>

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => { setForgotEmail(email.trim()); setForgotOpen(true); }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl transition shadow-md disabled:opacity-50 mt-2"
          >
            {submitting ? 'Authenticating...' : 'Log In'}
          </button>
        </form>


        {forgotOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <form onSubmit={handleForgotPassword} className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100">
              <h2 className="text-lg font-black text-gray-900">Forgot Password</h2>
              <p className="text-xs text-gray-500 mt-2">Enter your account email. The system will generate a new temporary password and send it to your email.</p>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-5 w-full text-xs border border-gray-200 rounded-xl p-3 outline-none bg-gray-50/50 focus:border-blue-500"
                autoFocus
              />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={forgotSubmitting} onClick={() => setForgotOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600">Cancel</button>
                <button type="submit" disabled={forgotSubmitting} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">{forgotSubmitting ? 'Resetting...' : 'Send New Password'}</button>
              </div>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/auth/register" className="text-blue-600 font-bold hover:underline">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
