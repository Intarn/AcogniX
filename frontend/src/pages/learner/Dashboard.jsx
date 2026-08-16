// frontend/src/pages/learner/Dashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getProgressOverview } from '../../services/progressService';
import { getWorkspaceData, uploadProjectMaterial } from '../../services/workspaceService';
import { getAllNotes } from '../../features/notes/noteApi';
import { useToast } from '../../contexts/ToastContext';
import { extractDocumentText } from '../../services/aiService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userEmail = user?.email || '';

  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTargetProjectId, setSelectedTargetProjectId] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState(null);
  const fileInputRef = useRef(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [progressRes, workspaceRes, noteResult] = await Promise.all([
        getProgressOverview(userEmail, 'Last 7 days').catch(() => null),
        getWorkspaceData().catch(() => null),
        getAllNotes().catch(() => ({ notes: [] }))
      ]);

      setOverviewData(progressRes);

      const projects = Array.isArray(workspaceRes?.AI_Project)
        ? workspaceRes.AI_Project
        : Array.isArray(workspaceRes?.AI_Projects)
        ? workspaceRes.AI_Projects
        : [];
      
      setProjectsList(projects);
      const activeProjects = projects.filter(p => p.status !== 'ARCHIVED' && p.status !== 'INACTIVE');
      if (activeProjects.length > 0) {
        setSelectedTargetProjectId(activeProjects[0].projectId || activeProjects[0].id);
      } else if (projects.length > 0) {
        setSelectedTargetProjectId(projects[0].projectId || projects[0].id);
      }

      let files = [];
      projects.forEach((project) => {
        const materials = project.Learning_Material || project.materials || [];
        files = [...files, ...materials];
      });
      setRecentFiles(files.slice(0, 5));

      const allNotes = Array.isArray(noteResult?.notes) ? noteResult.notes : (Array.isArray(noteResult) ? noteResult : []);
      setRecentNotes(
        allNotes.slice(0, 3).map((note) => ({
          id: note.noteId || note.id,
          title: note.title || 'Untitled Note',
          date: new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleDateString('en-US')
        }))
      );
    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error);
      showToast('Unable to synchronize overview data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [userEmail]);

  const handleDownloadFile = async (e, fileUrl, fileName) => {
    e.preventDefault();
    e.stopPropagation();
    if (!fileUrl) return;

    try {
      setDownloadingUrl(fileUrl);
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('Unable to download file from server.');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('[Dashboard Download Error]:', err);
      window.open(fileUrl, '_blank');
    } finally {
      setDownloadingUrl(null);
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (projectsList.length === 0) {
      return showToast("Please go to 'AI Workspace' to create a project before uploading materials!", 'warning');
    }
    if (file.size > 50 * 1024 * 1024) {
      return showToast('File exceeds allowed limit (50MB).', 'error');
    }
    setPendingFile(file);
    setShowUploadModal(true);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const confirmUploadToProject = async (e) => {
    e.preventDefault();
    if (!pendingFile || !selectedTargetProjectId) return;

    const targetProj = projectsList.find(p => (p.projectId === selectedTargetProjectId || p.id === selectedTargetProjectId));
    const isEnded = Boolean(
      targetProj?.status === 'ARCHIVED' ||
      targetProj?.status === 'INACTIVE' ||
      targetProj?.courseStatus === 'ARCHIVED' ||
      targetProj?.Course?.status === 'ARCHIVED'
    );

    if (isEnded) {
      showToast('Cannot upload materials to an ended or archived project/class.', 'error');
      return;
    }

    try {
      setUploading(true);
      showToast(`Uploading: ${pendingFile.name}...`, 'info');
      const uploadRes = await uploadProjectMaterial(selectedTargetProjectId, pendingFile);
      const materialId = uploadRes?.materialId || uploadRes?.material?.materialId || uploadRes?.id;
      if (materialId) {
        await extractDocumentText(materialId, pendingFile);
      }
      showToast('Materials uploaded and context extracted successfully!', 'success');
      setShowUploadModal(false);
      setPendingFile(null);
      await fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Unable to upload file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Synchronizing dashboard...</p>
        </div>
      </div>
    );
  }

  const chartLabels = overviewData?.chartData?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartValues = overviewData?.chartData?.data || [0, 0, 0, 0, 0, 0, 0];
  
  const chartConfig = {
    labels: chartLabels,
    datasets: [{
      label: 'Study Hours',
      data: chartValues,
      borderColor: '#2563EB',
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#2563EB',
      tension: 0.35,
      fill: true
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } },
      y: { min: 0, grid: { color: '#F3F4F6' }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } }
    }
  };

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-gray-50/50 relative">
      {/* SECTION 1: BANNER & HERO QUICK ACTION */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 bg-white rounded-3xl border border-gray-100 p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                AI Workspace Hub
              </span>
              <Link to="/learner/ai-workspace" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                Open workspace &rarr;
              </Link>
            </div>
            <h2 className="text-xl font-black text-gray-900 mt-1">Upload Study Materials</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Supports PDF and DOCX formats (up to 50MB) for the system to automatically extract context for the AI Tutor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center group hover:bg-blue-50/60 transition-colors">
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx" onChange={handleFileSelected} />
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg mb-2 shadow-md group-hover:scale-105 transition-transform">
                📁
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                Choose file from computer
              </button>
              <span className="text-[10px] text-gray-400 font-semibold mt-2">PDF, DOCX (≤ 50MB)</span>
            </div>

            <div className="flex flex-col justify-between bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">Recent Context Materials</span>
                <span className="text-[10px] bg-gray-200/70 text-gray-600 px-2 py-0.5 rounded-full font-bold">{recentFiles.length}</span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-28 pr-1">
                {recentFiles.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">No materials available.</p>
                ) : (
                  recentFiles.map((file, idx) => {
                    const fileUrl = file.sourceUrl || file.url;
                    const fileName = file.title || 'Untitled Material';
                    const isDownloadingThis = downloadingUrl === fileUrl;

                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-300 transition-colors">
                        <p className="text-xs font-bold text-gray-800 truncate max-w-[110px]" title={fileName}>
                          {fileName}
                        </p>
                        {fileUrl && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                              title="View material"
                            >
                              👁️ View
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadFile(e, fileUrl, fileName)}
                              disabled={isDownloadingThis}
                              className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              title="Download to computer"
                            >
                              {isDownloadingThis ? '⏳ Downloading...' : '📥 Download'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 rounded-3xl p-7 text-white flex flex-col justify-between shadow-lg shadow-blue-500/10">
          <div>
            <span className="text-[10px] bg-white/25 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-sm">
              Smart Assistant Engine
            </span>
            <h2 className="text-2xl font-black mt-3 leading-tight">Smart Learning Assistant</h2>
            <p className="text-xs text-blue-100 mt-2 leading-relaxed">
              Interact directly with AI Tutor based 100% on course material context, automatically generating flashcards and optimized practice quiz sets.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/15">
            <Link
              to="/learner/ai-workspace"
              className="flex-1 text-center bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold py-3 rounded-2xl shadow-md transition-all"
            >
              Open AI Workspace
            </Link>
            <Link
              to="/learner/flashcards"
              className="flex-1 text-center bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-3 rounded-2xl backdrop-blur-sm transition-all border border-white/20"
            >
              Flashcards Library
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 2: METRICS & STUDY ANALYTICS */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 bg-white rounded-3xl border border-gray-100 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-gray-900">Recent Notes</h3>
              <Link to="/learner/notes" className="text-xs font-bold text-blue-600 hover:underline">Manage</Link>
            </div>
            <div className="space-y-2.5">
              {recentNotes.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-gray-400 font-medium">No personal notes yet.</p>
                </div>
              ) : (
                recentNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-gray-50/80 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-800 truncate max-w-[160px]">{note.title}</p>
                    <span className="text-[10px] font-semibold text-gray-400">{note.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <Link
            to="/learner/notes"
            className="mt-4 w-full text-center py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition-colors block"
          >
            + Write New Note
          </Link>
        </div>

        <div className="col-span-12 md:col-span-5 bg-white rounded-3xl border border-gray-100 p-6 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-black text-gray-900">Study Time (Past 7 Days)</h3>
              <p className="text-[11px] text-gray-400 font-medium">Track active interaction time</p>
            </div>
            <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">
              {overviewData?.timeStudied || '0h 0m'}
            </span>
          </div>
          <div className="h-36 w-full my-2">
            <Line data={chartConfig} options={chartOptions} />
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-50">
            <Link to="/learner/progress" className="text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
              View detailed statistics &rarr;
            </Link>
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 bg-white rounded-3xl border border-gray-100 p-6 flex flex-col justify-between shadow-sm">
          <h3 className="text-sm font-black text-gray-900 mb-4">Achievement Overview</h3>
          <div className="grid grid-cols-2 gap-3 my-auto">
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100/50 flex flex-col justify-center">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Quizzes Passed</span>
              <span className="text-2xl font-black text-gray-900 mt-1">{overviewData?.quizzesPassed || 0}</span>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100/50 flex flex-col justify-center">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Flashcards</span>
              <span className="text-2xl font-black text-gray-900 mt-1">{overviewData?.flashcardsReviewed || 0}</span>
            </div>
          </div>
          <Link
            to="/learner/my-courses"
            className="mt-4 w-full text-center py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors block shadow-sm"
          >
            Explore Courses
          </Link>
        </div>
      </div>

      {/* MODAL SELECT PROJECT UPLOAD */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
            <div>
              <h3 className="text-base font-black text-gray-900">Select Project to Upload Materials</h3>
              <p className="text-xs text-gray-500 mt-1 truncate">
                File: <span className="font-bold text-blue-600">{pendingFile?.name}</span>
              </p>
            </div>

            <form onSubmit={confirmUploadToProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Target AI Project (Active projects only)</label>
                <select
                  value={selectedTargetProjectId}
                  onChange={(e) => setSelectedTargetProjectId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                >
                  {projectsList.map((p) => {
                    const isEnded = Boolean(p.status === 'ARCHIVED' || p.status === 'INACTIVE' || p.courseStatus === 'ARCHIVED' || p.Course?.status === 'ARCHIVED');
                    return (
                      <option key={p.projectId || p.id} value={p.projectId || p.id} disabled={isEnded}>
                        {p.name} {isEnded ? '(Ended/Archived)' : p.type === 'CLASS' ? '(Class)' : '(Personal)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setPendingFile(null); }}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}