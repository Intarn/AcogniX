// frontend/src/pages/auth/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validateEmail = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Hàm ánh xạ mọi lỗi thành thông báo tiếng Việt chuẩn xác
  const getVietnameseError = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status;

    // BẮT LỖI CHƯA XÁC THỰC EMAIL TỪ SUPABASE
    if (msg.includes('email not confirmed') || msg.includes('unverified') || msg.includes('xác thực')) {
      return 'Tài khoản chưa được xác thực. Vui lòng kiểm tra hộp thư email (kể cả thư rác) để bấm vào link xác thực!';
    }

    if (
      status === 401 || 
      msg.includes('incorrect email or password') || 
      msg.includes('invalid') || 
      msg.includes('credentials') ||
      msg.includes('thông tin')
    ) {
      return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!';
    }
    if (
      status === 403 || 
      msg.includes('banned') || 
      msg.includes('suspended')
    ) {
      return 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên để được hỗ trợ.';
    }
    if (
      status === 500 || 
      msg.includes('session creation failed') || 
      msg.includes('unable to log in')
    ) {
      return 'Hệ thống gặp sự cố khi xử lý đăng nhập. Vui lòng thử lại sau.';
    }
    if (
      msg.includes('failed to fetch') || 
      msg.includes('networkerror')
    ) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng.';
    }
    return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return showToast('Vui lòng nhập đầy đủ Email và Mật khẩu.', 'warning');
    }

    if (!validateEmail(cleanEmail)) {
      return showToast('Địa chỉ Email không đúng định dạng. Vui lòng kiểm tra lại.', 'warning');
    }

    try {
      setSubmitting(true);
      
      // Thực hiện gọi hàm đăng nhập
      const userRole = await login(cleanEmail, cleanPassword);

      // KIỂM TRA CHẶN ĐỨNG: Nếu login() trả về rỗng, false, hoặc object lỗi mà không throw
      if (!userRole || userRole === false || userRole?.error || userRole?.success === false) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Chỉ khi xác thực thành công thực sự mới chạy đến đây
      showToast('Đăng nhập thành công! Đang chuyển hướng...', 'success');

      const role = String(userRole?.userRole || userRole?.role || userRole).toUpperCase();
      if (role === 'SYSTEM_ADMINISTRATOR') {
        navigate('/admin/dashboard');
      } else if (role === 'EDUCATOR') {
        navigate('/educator/dashboard');
      } else {
        navigate('/learner/dashboard');
      }

    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
      // Bắt mọi lỗi và hiển thị Toast đỏ tiếng Việt chuẩn xác
      showToast(getVietnameseError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-800">Chào mừng trở lại!</h1>
          <p className="text-xs text-gray-400 mt-1">Đăng nhập để tiếp tục không gian học tập thông minh cùng AI</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@acognix.com"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl transition shadow-md disabled:opacity-50 mt-2"
          >
            {submitting ? 'Đang xác thực...' : 'Đăng Nhập'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Chưa có tài khoản?{' '}
          <Link to="/auth/register" className="text-blue-600 font-bold hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}