// frontend/src/pages/auth/Register.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../services/apiClient';

export default function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'LEARNER'
  });

  const [submitting, setSubmitting] = useState(false);

  const validateEmail = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { displayName, email, password, confirmPassword, role } = formData;
    const cleanName = displayName.trim();
    const cleanEmail = email.trim();

    // 1. Kiểm tra điền thiếu trường
    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      return showToast('Vui lòng điền đầy đủ tất cả các trường thông tin.', 'warning');
    }

    // 2. Kiểm tra định dạng Email
    if (!validateEmail(cleanEmail)) {
      return showToast('Địa chỉ Email không đúng định dạng. Vui lòng kiểm tra lại.', 'warning');
    }

    // 3. Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
      return showToast('Mật khẩu phải có độ dài tối thiểu 6 ký tự.', 'warning');
    }

    // 4. Kiểm tra mật khẩu xác nhận
    if (password !== confirmPassword) {
      return showToast('Mật khẩu xác nhận không trùng khớp!', 'error');
    }

    try {
      setSubmitting(true);
      
      await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          displayName: cleanName,
          email: cleanEmail,
          password,
          role
        })
      });

      // THAY ĐỔI: Thông báo nhắc người dùng vào email xác thực
      showToast('Đăng ký thành công! Vui lòng kiểm tra email của bạn (kể cả thư rác) để xác thực tài khoản trước khi đăng nhập.', 'success');
      navigate('/auth/login');

    } catch (err) {
      console.error('Lỗi đăng ký:', err);

      const status = err.status;
      const message = err.message || '';

      // 5. Bắt chính xác lỗi đăng ký trùng Email hoặc lỗi kết nối
      if (status === 409 || message.includes('already registered') || message.includes('EMAIL_ALREADY_REGISTERED')) {
        showToast('Địa chỉ email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập!', 'error');
      } else if (message.includes('valid email')) {
        showToast('Địa chỉ email không đúng định dạng.', 'warning');
      } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        showToast('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.', 'error');
      } else if (status === 400) {
        showToast('Thông tin đăng ký không hợp lệ. Vui lòng kiểm tra lại.', 'warning');
      } else {
        showToast(message || 'Đăng ký không thành công. Vui lòng thử lại sau.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-gray-800">Tạo Tài Khoản Mới</h1>
          <p className="text-xs text-gray-400 mt-1">Bắt đầu trải nghiệm không gian học tập thông minh cùng AcogniX AI</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Họ và tên</label>
            <input
              type="text"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Nguyễn Văn A"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="nhanvien@acognix.com"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Vai trò của bạn</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'LEARNER' }))}
                className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                  formData.role === 'LEARNER'
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Học viên (Learner)
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'EDUCATOR' }))}
                className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                  formData.role === 'EDUCATOR'
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Giảng viên (Educator)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Xác nhận mật khẩu</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl transition shadow-md disabled:opacity-50 mt-2"
          >
            {submitting ? 'Đang tạo tài khoản...' : 'Tạo Tài Khoản'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Đã có tài khoản?{' '}
          <Link to="/auth/login" className="text-blue-600 font-bold hover:underline">
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
}