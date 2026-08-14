// frontend/src/components/common/NotificationPopover.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// ==========================================
// MOCK DATA: THÔNG BÁO THEO TỪNG VAI TRÒ
// ==========================================
const MOCK_NOTIFICATIONS = {
  LEARNER: [
    {
      id: 'l1',
      title: 'Thông báo lớp học mới',
      message: 'Giảng viên đã đăng thông báo mới trong lớp Lập trình C++.',
      type: 'ANNOUNCEMENT',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/learner/courses/c-101/announcements'
    },
    {
      id: 'l2',
      title: 'Bài kiểm tra đã xuất bản',
      message: 'Quiz 01 - C++ Fundamentals đã sẵn sàng làm bài.',
      type: 'ASSESSMENT',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      read: false,
      link: '/learner/courses/c-101/assessments'
    },
    {
      id: 'l3',
      title: 'Tài liệu học tập mới',
      message: 'Slide bài giảng chương 2 đã được cập nhật.',
      type: 'MATERIAL',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      read: true,
      link: '/learner/courses/c-101/materials'
    },
    {
      id: 'l4',
      title: 'Yêu cầu tham gia lớp được chấp nhận',
      message: 'Bạn đã chính thức trở thành thành viên của lớp C++.',
      type: 'ENROLLMENT',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      read: true,
      link: '/learner/my-courses'
    }
  ],
  EDUCATOR: [
    {
      id: 'e1',
      title: 'Yêu cầu tham gia lớp học',
      message: 'Trần Đăng Khoa vừa yêu cầu tham gia lớp "Lập trình C++".',
      type: 'ENROLL_REQUEST',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/educator/courses/c-101/members'
    },
    {
      id: 'e2',
      title: 'Báo cáo hiệu suất lớp học (Tuần)',
      message: 'Hệ thống đã tổng hợp báo cáo. Có 3 sinh viên cần được chú ý.',
      type: 'WEEKLY_REPORT',
      createdAt: new Date(Date.now() - 43200000).toISOString(), // 12 tiếng trước
      read: false,
      link: '/educator/courses/c-101/analytics'
    }
  ],
  SYSTEM_ADMINISTRATOR: [
    {
      id: 'a1',
      title: 'Cảnh báo hạn mức LLM API',
      message: 'API Key của Gemini đã sử dụng 90% hạn mức trong ngày.',
      type: 'SYSTEM_ALERT',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/admin/settings'
    },
    {
      id: 'a2',
      title: 'Có Ticket hỗ trợ mới',
      message: 'Một giảng viên vừa gửi yêu cầu hỗ trợ hệ thống.',
      type: 'TICKET',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      read: true,
      link: '/admin/tickets'
    }
  ]
};

export default function NotificationPopover() {
  const { user } = useAuth(); // Lấy thông tin user hiện tại
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const popoverRef = useRef(null);

  // Load danh sách thông báo tương ứng với Role
  useEffect(() => {
    if (user?.role) {
      const roleKey = String(user.role).toUpperCase();
      setNotifications(MOCK_NOTIFICATIONS[roleKey] || []);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Đóng popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setIsOpen(false);
  };

  // Cấu hình Icon và Màu sắc cho TỪNG LOẠI THÔNG BÁO (Bao gồm cả Educator & Admin)
  const getIconConfig = (type) => {
    switch(type) {
      // Learner Types
      case 'ANNOUNCEMENT': return { icon: '📣', bg: 'bg-amber-100', text: 'text-amber-600' };
      case 'ASSESSMENT': return { icon: '📝', bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'MATERIAL': return { icon: '📁', bg: 'bg-emerald-100', text: 'text-emerald-600' };
      case 'ENROLLMENT': return { icon: '✅', bg: 'bg-green-100', text: 'text-green-600' };
      
      // Educator Types
      case 'ENROLL_REQUEST': return { icon: '👤', bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'WEEKLY_REPORT': return { icon: '📊', bg: 'bg-purple-100', text: 'text-purple-600' };
      
      // Admin Types
      case 'SYSTEM_ALERT': return { icon: '⚠️', bg: 'bg-red-100', text: 'text-red-600' };
      case 'TICKET': return { icon: '🎫', bg: 'bg-orange-100', text: 'text-orange-600' };
      
      default: return { icon: '🔔', bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* NÚT CHUÔNG */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all ${isOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* POPOVER DROPDOWN PANEL */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden flex flex-col">
          
          {/* HEADER POPOVER */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-800">Thông báo hệ thống</h3>
              {unreadCount > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* LIST THÔNG BÁO */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map(item => {
                const config = getIconConfig(item.type);
                return (
                  <Link
                    key={item.id}
                    to={item.link || '#'}
                    onClick={() => handleNotificationClick(item.id)}
                    className={`block p-4 transition-colors hover:bg-gray-50 ${!item.read ? 'bg-blue-50/20' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full ${config.bg} ${config.text} flex items-center justify-center flex-shrink-0 text-sm font-bold`}>
                        {config.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs truncate ${!item.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                            {item.title}
                          </p>
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                          )}
                        </div>

                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>

                        <span className="text-[9px] text-gray-400 mt-1.5 block font-semibold uppercase">
                          {new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          
          {/* FOOTER POPOVER */}
          <div className="p-3 border-t border-gray-100 text-center bg-gray-50">
            <Link to="#" className="text-[11px] font-bold text-gray-500 hover:text-gray-800 transition-colors">
              Xem tất cả thông báo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}