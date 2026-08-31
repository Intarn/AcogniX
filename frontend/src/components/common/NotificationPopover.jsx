import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEducatorNotifications,
  markEducatorNotificationRead
} from '../../services/analyticsService';

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function NotificationPopover() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const result = await getEducatorNotifications();
      setNotifications(Array.isArray(result?.notifications) ? result.notifications : []);
      setUnreadCount(Number(result?.unreadCount || 0));
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to load Educator notifications:', error);
      if (!silent) {
        setErrorMessage(error.message || 'Unable to load notifications.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) loadNotifications({ silent: true });
      return next;
    });
  };

  const handleNotificationClick = async (notification) => {
    const targetUrl = notification?.targetUrl
      || `/educator/analytics?courseId=${encodeURIComponent(String(notification?.courseId || ''))}&weekly=1`;

    // Update the UI immediately, then persist the read state. Navigation must
    // still work if marking the item read encounters a transient server error.
    if (notification?.read !== true) {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read: true } : item
      )));
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        const result = await markEducatorNotificationRead(notification.id);
        if (Number.isFinite(Number(result?.unreadCount))) {
          setUnreadCount(Number(result.unreadCount));
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        loadNotifications({ silent: true });
      }
    }

    setOpen(false);
    navigate(targetUrl);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative w-10 h-10 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-gray-900">Notifications</p>
              <p className="text-[10px] font-semibold text-gray-400 mt-0.5">
                Weekly class-performance reports
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-xs font-semibold text-gray-400">
                Loading notifications...
              </div>
            ) : errorMessage ? (
              <div className="px-4 py-6">
                <p className="text-xs font-bold text-red-600">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => loadNotifications()}
                  className="mt-3 text-xs font-black text-blue-600 hover:text-blue-700"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs font-bold text-gray-500">No weekly-report notifications yet.</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Generated reports will appear here automatically.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-50 last:border-b-0 transition-colors ${
                    notification.read === true
                      ? 'bg-white hover:bg-gray-50'
                      : 'bg-blue-50/60 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      notification.read === true ? 'bg-gray-200' : 'bg-blue-600'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-gray-900">
                        {notification.title || 'Weekly class-performance report ready'}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-600 mt-1 truncate">
                        {notification.message || 'Class Performance Statistics'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        {formatNotificationTime(notification.createdAt || notification.generatedAt)}
                      </p>
                    </div>
                    <span className="text-blue-500 text-sm font-black" aria-hidden="true">→</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
