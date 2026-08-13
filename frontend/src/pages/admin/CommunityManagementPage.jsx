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
      // Update according to the actual API response structure later
      setReports(response.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId, action) => {
    const deleting = action === 'DELETE';
    const confirmed = await confirm({
      title: deleting ? 'Delete reported post?' : 'Ignore this report?',
      message: deleting
        ? 'This will remove the reported post from the community. This action cannot be undone from this screen.'
        : 'The report will be marked as handled without deleting the reported post.',
      confirmLabel: deleting ? 'Delete Post' : 'Ignore',
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Community Moderation</h1>
      </header>
      <main className="flex-1 p-6 overflow-y-auto">
        <h3 className="text-base font-bold text-gray-800 mb-4">Reported Content</h3>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-6 py-3">Author</th>
                <th className="px-6 py-3">Content Snippet</th>
                <th className="px-6 py-3">Report Reason</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-4">Loading reports...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-4 text-gray-500">No pending reports.</td></tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800">{report.author}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{report.content}</td>
                    <td className="px-6 py-4 text-red-500 font-medium">{report.reason}</td>
                    <td className="px-6 py-4 flex gap-3">
                      <button onClick={() => handleResolve(report.id, 'DELETE')} className="text-xs font-bold text-red-600 hover:underline">Delete Post</button>
                      <button onClick={() => handleResolve(report.id, 'IGNORE')} className="text-xs font-bold text-gray-500 hover:underline">Ignore</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}