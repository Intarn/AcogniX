import { useState, useEffect } from 'react';
import { getReportedPosts, resolveReport } from '../../features/community/communityApi';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export default function CommunityManagementPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await getReportedPosts();
      setReports(response.reports || []);
    } catch (error) {
      showToast('Failed to fetch reported content.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId, action) => {
    const deleting = action === 'DELETE';
    const confirmed = await confirm({
      title: deleting ? 'Delete Reported Post?' : 'Ignore Report?',
      message: deleting
        ? 'This will remove the reported post from the community. This action cannot be undone.'
        : 'The report will be marked as handled without deleting the post.',
      confirmLabel: deleting ? 'Delete Post' : 'Ignore Report',
      cancelLabel: 'Cancel',
      tone: deleting ? 'danger' : 'primary'
    });
    if (!confirmed) return;

    try {
      await resolveReport(reportId, action);
      await fetchReports();
      showToast(deleting ? 'Post deleted successfully.' : 'Report ignored successfully.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center px-8 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Community Moderation</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Review and resolve reported community posts and discussions.</p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-base font-black text-gray-900">Reported Content</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Flagged items awaiting moderator review.</p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">{reports.length} reports</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Author</th>
                  <th className="px-6 py-4">Content Snippet</th>
                  <th className="px-6 py-4">Report Reason</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-10 text-gray-400 font-bold">Loading reports...</td></tr>
                ) : reports.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-gray-400 font-bold">No pending reports found.</td></tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">{report.author}</td>
                      <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{report.content}</td>
                      <td className="px-6 py-4 font-black text-red-600">{report.reason}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleResolve(report.id, 'DELETE')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition shadow-xs">
                            Delete Post
                          </button>
                          <button onClick={() => handleResolve(report.id, 'IGNORE')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition shadow-xs">
                            Ignore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}