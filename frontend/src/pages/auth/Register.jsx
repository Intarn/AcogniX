// frontend/src/pages/auth/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../services/apiClient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  role: 'LEARNER'
};

export default function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicateEmailError, setDuplicateEmailError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: false }));

    if (name === 'email') {
      setDuplicateEmailError(false);
    }
  };

  const selectRole = (role) => {
    setFormData((prev) => ({ ...prev, role }));
    setFieldErrors((prev) => ({ ...prev, role: false }));
  };

  const validateForm = () => {
    const errors = {};
    const normalizedEmail = formData.email.trim();
    const normalizedDisplayName = formData.displayName.trim();

    // UC20-UI04: highlight every missing required field.
    if (!normalizedDisplayName) errors.displayName = true;
    if (!normalizedEmail) errors.email = true;
    if (!formData.password) errors.password = true;
    if (!formData.confirmPassword) errors.confirmPassword = true;
    if (!formData.role) errors.role = true;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showToast('Please complete all required fields.', 'warning');
      return false;
    }

    // UC20-UI05: use application validation instead of the browser's native
    // type=email message so the expected message is deterministic.
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setFieldErrors({ email: true });
      showToast('Please enter a valid email address.', 'error');
      return false;
    }

    // UC20-UI03: only Confirm Password is highlighted for a mismatch.
    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: true });
      showToast('Password and Confirm Password do not match.', 'error');
      return false;
    }

    // UC20-UI08: Admin is never offered in the UI and any manipulated local
    // role value is rejected before the request is sent.
    if (!['LEARNER', 'EDUCATOR'].includes(formData.role)) {
      setFieldErrors({ role: true });
      showToast('Please select either Learner or Educator.', 'error');
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setDuplicateEmailError(false);

    if (!validateForm()) return;

    try {
      setLoading(true);
      const result = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email.trim(),
          displayName: formData.displayName.trim(),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: formData.role
        })
      });

      showToast(
        result?.message || 'Your account has been created successfully.',
        'success'
      );
      navigate(result?.redirectTo || '/auth/login', { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_ALREADY_REGISTERED') {
        setFieldErrors({ email: true });
        setDuplicateEmailError(true);
        showToast('This email address is already registered.', 'error');
        return;
      }

      if (err.code === 'MISSING_REQUIRED_INFORMATION') {
        showToast('Please complete all required fields.', 'warning');
        return;
      }

      if (err.code === 'INVALID_EMAIL_FORMAT') {
        setFieldErrors({ email: true });
        showToast('Please enter a valid email address.', 'error');
        return;
      }

      if (err.code === 'PASSWORD_CONFIRMATION_MISMATCH') {
        setFieldErrors({ confirmPassword: true });
        showToast('Password and Confirm Password do not match.', 'error');
        return;
      }

      if (err.code === 'INVALID_REGISTRATION_ROLE') {
        setFieldErrors({ role: true });
        showToast('Please select either Learner or Educator.', 'error');
        return;
      }

      // UC20-UI09: network/server/DB failures use the same recoverable message.
      showToast('Unable to create your account. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = () => {
    // UC20-UI10: unsaved registration information exists only in component
    // state, so resetting it before navigation guarantees it is discarded.
    setFormData(EMPTY_FORM);
    setFieldErrors({});
    setDuplicateEmailError(false);
    navigate('/auth/login', { replace: true });
  };

  const inputClass = (fieldName) =>
    `w-full text-xs p-3 bg-gray-50 border rounded-xl outline-none focus:bg-white transition-all ${
      fieldErrors[fieldName]
        ? 'border-red-500 focus:border-red-500 bg-red-50'
        : 'border-gray-200 focus:border-blue-500'
    }`;

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Create AcogniX Account</h1>
        <p className="text-xs text-gray-400 mt-1">Register to experience learning with AI Tutor</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Nickname</label>
          <input
            type="text"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.displayName)}
            placeholder="learner01"
            className={inputClass('displayName')}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.email)}
            placeholder="name@example.com"
            className={inputClass('email')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.password)}
              placeholder="••••••••"
              className={inputClass('password')}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              placeholder="••••••••"
              className={inputClass('confirmPassword')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Your Role</label>
          <div
            className={`grid grid-cols-2 gap-3 rounded-xl ${
              fieldErrors.role ? 'ring-1 ring-red-500' : ''
            }`}
            aria-invalid={Boolean(fieldErrors.role)}
          >
            <button
              type="button"
              onClick={() => selectRole('LEARNER')}
              className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                formData.role === 'LEARNER'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              🎓 Learner
            </button>
            <button
              type="button"
              onClick={() => selectRole('EDUCATOR')}
              className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                formData.role === 'EDUCATOR'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              👨‍🏫 Educator
            </button>
          </div>
        </div>

        {duplicateEmailError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-semibold">This email address is already registered.</p>
            <button
              type="button"
              onClick={handleCancelRegistration}
              className="mt-2 font-bold text-blue-700 hover:underline"
            >
              Return to Log In
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancelRegistration}
            disabled={loading}
            className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-xs text-gray-500">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-blue-600 font-bold hover:underline">
          Log in now
        </Link>
      </div>
    </div>
  );
}
