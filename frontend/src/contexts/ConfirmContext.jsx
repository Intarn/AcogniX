import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(({ title = 'Please confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary' }) => {
    return new Promise((resolve) => {
      setRequest({ title, message, confirmLabel, cancelLabel, tone, resolve });
    });
  }, []);

  const close = useCallback((result) => {
    if (!request) return;
    request.resolve(result);
    setRequest(null);
  }, [request]);

  useEffect(() => {
    if (!request) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [request, close]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {request && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${request.tone === 'danger' ? 'bg-red-50 text-red-600' : request.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                {request.tone === 'danger' ? '!' : request.tone === 'success' ? '✓' : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-sm font-bold text-gray-900">{request.title}</h2>
                <p className="mt-2 text-xs leading-5 text-gray-500">{request.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                {request.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition ${request.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : request.tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {request.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm phải được sử dụng trong ConfirmProvider');
  return context;
};
