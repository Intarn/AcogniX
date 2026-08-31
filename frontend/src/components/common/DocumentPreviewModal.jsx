import { useEffect, useMemo, useState } from 'react';
import { docxBlobToHtml, isDocxDocument, isPdfDocument } from '../../utils/documentPreview';

export default function DocumentPreviewModal({
  open,
  title,
  fileName,
  blob,
  contentType,
  onClose,
  onDownload,
  downloading = false
}) {
  const [objectUrl, setObjectUrl] = useState('');
  const [docxHtml, setDocxHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDocx = useMemo(() => isDocxDocument(contentType, fileName), [contentType, fileName]);
  const isPdf = useMemo(() => isPdfDocument(contentType, fileName), [contentType, fileName]);

  useEffect(() => {
    let cancelled = false;
    let nextObjectUrl = '';

    async function preparePreview() {
      setDocxHtml('');
      setError('');
      if (!open || !blob) return;

      try {
        setLoading(true);
        if (isDocx) {
          const html = await docxBlobToHtml(blob);
          if (!cancelled) setDocxHtml(html);
        } else if (isPdf) {
          nextObjectUrl = window.URL.createObjectURL(blob);
          if (!cancelled) setObjectUrl(nextObjectUrl);
        } else {
          setError('Preview is available for PDF and DOCX files. Please use Download for this file type.');
        }
      } catch (previewError) {
        if (!cancelled) setError(previewError.message || 'Unable to preview this document.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    preparePreview();

    return () => {
      cancelled = true;
      if (nextObjectUrl) window.URL.revokeObjectURL(nextObjectUrl);
      setObjectUrl('');
    };
  }, [open, blob, isDocx, isPdf]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[88vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-gray-900 truncate">{title || fileName || 'Document Preview'}</h3>
            {fileName && <p className="text-[11px] font-semibold text-gray-500 truncate mt-0.5">{fileName}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold disabled:opacity-50"
              >
                {downloading ? 'Downloading...' : 'Download'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold"
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-gray-100 p-3 overflow-hidden">
          {loading ? (
            <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center text-xs font-bold text-gray-500">Preparing document preview...</div>
          ) : error ? (
            <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center p-8 text-center text-sm font-bold text-red-500">{error}</div>
          ) : isPdf && objectUrl ? (
            <iframe src={objectUrl} title={title || fileName || 'PDF preview'} className="w-full h-full rounded-2xl bg-white border-0" />
          ) : isDocx ? (
            <div className="w-full h-full rounded-2xl bg-white overflow-y-auto">
              <article
                className="max-w-4xl mx-auto px-8 py-8 text-gray-800"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
