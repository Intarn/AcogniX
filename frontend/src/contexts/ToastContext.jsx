// frontend/src/contexts/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, clearToasts }}>
      {children}

      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-xs font-semibold backdrop-blur-md transition-all animate-bounce-once ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-800'
                : toast.type === 'warning'
                ? 'bg-amber-50/95 border-amber-200 text-amber-800'
                : 'bg-blue-50/95 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base flex-shrink-0">
                {toast.type === 'success' && '✅'}
                {toast.type === 'error' && '⚠️'}
                {toast.type === 'warning' && '🔔'}
                {toast.type === 'info' && 'ℹ️'}
              </span>
              <p className="leading-relaxed truncate-2-lines">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 font-bold text-sm px-1 flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast phải được sử dụng trong ToastProvider');
  return context;
};
