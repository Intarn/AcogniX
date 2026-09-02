import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSystemHealth,
  getApiUsage,
  getPlatformAnalytics,
  getInfrastructureErrorLogs,
  restartDatabaseConnection,
  updateLLMKey
} from '../../services/infrastructureService';

const EMPTY_ANALYTICS = {
  overview: {
    totalUsers: 0,
    activeLearnersLast15Minutes: 0,
    activeCourses: 0,
    approvedEnrollments: 0,
    studyMinutesToday: 0,
    gradedOrSubmittedToday: 0,
    supportTicketsCreatedToday: 0
  },
  activityTrend: [],
  topCourses: [],
  aiUsage: {
    requestsToday: 0,
    chatResponsesToday: 0,
    quizzesGeneratedToday: 0,
    flashcardSetsGeneratedToday: 0,
    estimatedTokensConsumed: 0,
    tokenUsageIsEstimated: true,
    quotaWarning: false,
    quotaReference: 100000
  }
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function databaseDisplay(status) {
  if (status === 'ONLINE') return { label: 'Online', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (status === 'DEGRADED') return { label: 'Degraded', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (status === 'OFFLINE') return { label: 'Offline', className: 'bg-red-50 text-red-700 border-red-200' };
  return { label: 'Unavailable', className: 'bg-gray-50 text-gray-600 border-gray-200' };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function normalizePdfText(value) {
  return String(value ?? '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

function wrapPdfLine(value, maxLength = 92) {
  const source = normalizePdfText(value);
  if (source.length <= maxLength) return [source];
  const words = source.split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLength) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function escapePdfText(value) {
  return normalizePdfText(value).replace(/([\\()])/g, '\\$1');
}

function createPdfBlob(rows) {
  const logicalLines = rows.flatMap((row) => row.length === 0 ? [''] : wrapPdfLine(row.join(' | ')));
  const linesPerPage = 48;
  const pages = [];
  for (let i = 0; i < logicalLines.length; i += linesPerPage) pages.push(logicalLines.slice(i, i + linesPerPage));
  if (!pages.length) pages.push(['System Infrastructure Performance Report']);

  const fontId = 3 + (pages.length * 2);
  const objects = new Array(fontId + 1);
  const pageIds = pages.map((_, index) => 3 + (index * 2));
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  pages.forEach((pageLines, index) => {
    const pageId = 3 + (index * 2);
    const contentId = pageId + 1;
    const content = ['BT', '/F1 9 Tf', '48 790 Td', '12 TL', ...pageLines.flatMap(line => [`(${escapePdfText(line)}) Tj`, 'T*']), 'ET'].join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets = new Array(fontId + 1).fill(0);
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function createCsvBlob(rows) {
  const csv = rows
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  return new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
}

function buildReportRows(health, usage, analytics) {
  const db = databaseDisplay(health?.databaseStatus);
  const tokenValue = usage?.tokensConsumed ?? usage?.estimatedTokensConsumed ?? analytics?.aiUsage?.estimatedTokensConsumed ?? 0;
  const requestValue = usage?.apiRequestsToday ?? analytics?.aiUsage?.requestsToday ?? 0;
  return [
    ['System Infrastructure Performance Report'],
    ['Generated At', new Date().toLocaleString()],
    [],
    ['Server Health'],
    ['CPU Load', `${health?.cpuLoad ?? '--'}%`],
    ['RAM Used', health?.ram ? `${health.ram.usedGB} / ${health.ram.totalGB} GB` : '--'],
    ['RAM Usage', health?.ram ? `${health.ram.usagePercentage}%` : '--'],
    ['Database Status', db.label],
    ['Database Latency', health?.databaseLatencyMs == null ? '--' : `${health.databaseLatencyMs} ms`],
    ['Database Error', health?.databaseError || 'None'],
    [],
    ['LLM API Usage - Today'],
    ['Requests', requestValue],
    ['AI Tokens Consumed', tokenValue],
    ['Quota Reference', usage?.quotaReference ?? analytics?.aiUsage?.quotaReference ?? '--'],
    ['Quota Warning', usage?.quotaWarning ? 'API Quota Limit' : 'No'],
    [],
    ['Platform Snapshot'],
    ['Total Users', analytics?.overview?.totalUsers ?? 0],
    ['Active Learners (15m)', analytics?.overview?.activeLearnersLast15Minutes ?? 0],
    ['Active Courses', analytics?.overview?.activeCourses ?? 0],
    ['Study Minutes Today', analytics?.overview?.studyMinutesToday ?? 0]
  ];
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [health, setHealth] = useState(null);
  const [usage, setUsage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshError, setRefreshError] = useState('');

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exporting, setExporting] = useState(false);

  const [keyOpen, setKeyOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState('');
  const [keyError, setKeyError] = useState('');

  const [dbRestarting, setDbRestarting] = useState(false);
  const [dbActionMessage, setDbActionMessage] = useState('');

  const fetchInfrastructureData = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setRefreshError('');

    const [healthResult, usageResult, analyticsResult, logsResult] = await Promise.allSettled([
      getSystemHealth(),
      getApiUsage(),
      getPlatformAnalytics(),
      getInfrastructureErrorLogs(50)
    ]);

    if (healthResult.status === 'fulfilled') {
      const latestHealth = healthResult.value;
      setHealth(latestHealth);

      // A previous successful reconnect message must not remain visible after
      // a later database failure/degraded health result.
      if (latestHealth?.databaseStatus !== 'ONLINE') {
        setDbActionMessage('');
      }
    } else {
      setRefreshError('Some infrastructure data could not be refreshed.');
    }

    if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
    if (analyticsResult.status === 'fulfilled') setAnalytics({ ...EMPTY_ANALYTICS, ...analyticsResult.value });
    if (logsResult.status === 'fulfilled') setLogs(logsResult.value?.logs || []);

    setLastUpdated(new Date());
    setLoading(false);

    return {
      health: healthResult.status === 'fulfilled' ? healthResult.value : null,
      usage: usageResult.status === 'fulfilled' ? usageResult.value : null,
      analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : null
    };
  }, []);

  useEffect(() => {
    fetchInfrastructureData();
    const intervalId = window.setInterval(() => fetchInfrastructureData({ quiet: true }), 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchInfrastructureData]);

  const dbDisplay = databaseDisplay(health?.databaseStatus);
  const trend = analytics.activityTrend || [];
  const maxStudyMinutes = Math.max(...trend.map(day => Number(day.studyMinutes || 0)), 1);
  const llmRequests = usage?.apiRequestsToday ?? analytics.aiUsage?.requestsToday ?? 0;
  const tokenConsumed = usage?.tokensConsumed ?? usage?.estimatedTokensConsumed ?? analytics.aiUsage?.estimatedTokensConsumed ?? 0;
  const quotaWarning = Boolean(usage?.quotaWarning ?? analytics.aiUsage?.quotaWarning);
  const quotaReference = usage?.quotaReference ?? analytics.aiUsage?.quotaReference ?? 100000;

  const latestError = useMemo(() => logs[0] || null, [logs]);

  const handleRestartDatabase = async () => {
    setDbRestarting(true);
    setDbActionMessage('');
    try {
      const result = await restartDatabaseConnection();
      setDbActionMessage(result?.message || 'Database connection re-established successfully.');
      await fetchInfrastructureData({ quiet: true });
    } catch (error) {
      setDbActionMessage(error?.message || 'Connection Timeout');
      await fetchInfrastructureData({ quiet: true });
    } finally {
      setDbRestarting(false);
    }
  };

  const confirmApiKeyUpdate = async () => {
    const trimmed = apiKey.trim();
    setKeyError('');
    setKeyMessage('');
    if (!trimmed) {
      setKeyError('API Key cannot be empty.');
      return;
    }
    setKeySaving(true);
    try {
      const result = await updateLLMKey(trimmed);
      setKeyMessage(result?.message || 'Backup API Key updated successfully.');
      setApiKey('');
      await fetchInfrastructureData({ quiet: true });
      window.setTimeout(() => setKeyOpen(false), 600);
    } catch (error) {
      setKeyError(error?.message || 'Failed to update Backup API Key.');
    } finally {
      setKeySaving(false);
    }
  };

  const confirmExport = async () => {
    setExporting(true);
    try {
      const latest = await fetchInfrastructureData({ quiet: true });
      const latestHealth = latest.health || health;
      const latestUsage = latest.usage || usage;
      const latestAnalytics = latest.analytics || analytics;
      const rows = buildReportRows(latestHealth, latestUsage, latestAnalytics);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (exportFormat === 'pdf') {
        downloadBlob(createPdfBlob(rows), `System_Infrastructure_Report_${stamp}.pdf`);
      } else {
        downloadBlob(createCsvBlob(rows), `System_Infrastructure_Report_${stamp}.csv`);
      }
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 py-4 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Monitor Infrastructure</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Real-time server, database and LLM API monitoring
            {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setExportOpen(true)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-xl transition">
            Export Report
          </button>
          <button type="button" onClick={() => fetchInfrastructureData()} disabled={loading} className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50">
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <main className="p-8 overflow-y-auto space-y-6">
        {refreshError && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 text-xs font-bold">{refreshError}</div>}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <HealthSummaryCard label="CPU" value={health ? `${health.cpuLoad}%` : '--'} detail={`${health?.cpuCount ?? '--'} logical CPUs`} />
          <HealthSummaryCard label="RAM" value={health?.ram ? `${health.ram.usagePercentage}%` : '--'} detail={health?.ram ? `${health.ram.usedGB} / ${health.ram.totalGB} GB used` : 'Unavailable'} />
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Database</p>
                <p className="text-2xl font-black text-gray-900 mt-2">{dbDisplay.label}</p>
                <p className="text-[11px] text-gray-500 mt-1">{health?.databaseLatencyMs == null ? 'Latency unavailable' : `${health.databaseLatencyMs} ms`}</p>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${dbDisplay.className}`}>{dbDisplay.label}</span>
            </div>
            {health?.databaseStatus === 'OFFLINE' && (
              <div className="mt-4 pt-4 border-t border-red-100">
                <p className="text-xs font-black text-red-700">{health?.databaseError || 'Connection Timeout'}</p>
                <button type="button" disabled={dbRestarting} onClick={handleRestartDatabase} className="mt-3 text-xs font-bold px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                  {dbRestarting ? 'Restarting...' : 'Restart Database Connection'}
                </button>
              </div>
            )}
            {dbActionMessage && <p className="text-[11px] font-semibold text-gray-600 mt-3">{dbActionMessage}</p>}
          </div>
        </section>

        <div className="bg-white rounded-2xl border border-gray-100 p-1.5 flex gap-1 w-fit">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
          <TabButton active={activeTab === 'llm'} onClick={() => setActiveTab('llm')}>LLM API Usage</TabButton>
          <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')}>Error Logs</TabButton>
        </div>

        {activeTab === 'overview' && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <StatCard label="Total Users" value={loading ? '...' : formatNumber(analytics.overview.totalUsers)} />
              <StatCard label="Active Learners (15m)" value={loading ? '...' : formatNumber(analytics.overview.activeLearnersLast15Minutes)} color="text-emerald-600" />
              <StatCard label="Active Courses" value={loading ? '...' : formatNumber(analytics.overview.activeCourses)} color="text-blue-600" />
              <StatCard label="Study Minutes Today" value={loading ? '...' : formatNumber(analytics.overview.studyMinutesToday)} color="text-indigo-600" />
            </section>

            <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-black text-gray-900">Platform Activity — Last 7 Days</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Latest activity data retrieved from the server.</p>
              </div>
              <div className="h-64 flex items-end gap-3 pt-6 px-2">
                {trend.map(day => (
                  <div key={day.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500">{day.studyMinutes || 0}m</span>
                    <div className="w-full max-w-12 bg-indigo-500 rounded-t-xl min-h-[6px]" style={{ height: `${Math.max(6, (Number(day.studyMinutes || 0) / maxStudyMinutes) * 160)}px` }} />
                    <span className="text-[10px] font-semibold text-gray-400">{day.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'llm' && (
          <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xs space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-gray-900">LLM API Usage</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Requests and AI token consumption recorded throughout the current day.</p>
              </div>
              <button type="button" onClick={() => { setKeyOpen(true); setKeyError(''); setKeyMessage(''); }} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">
                Update API Key
              </button>
            </div>

            {quotaWarning && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-sm font-black text-red-800">API Quota Limit</p>
                <p className="text-xs text-red-700 mt-1">The configured daily LLM API quota has been reached or exceeded. Update the backup API key to keep AI-dependent features available.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatBoxMini label="Requests Today" value={formatNumber(llmRequests)} />
              <StatBoxMini label="AI Tokens Consumed" value={formatNumber(tokenConsumed)} color="text-emerald-600" />
              <StatBoxMini label="Daily Token Quota" value={formatNumber(quotaReference)} color="text-indigo-600" />
              <StatBoxMini label="Usage Source" value={usage?.tokenUsageIsEstimated ? 'Estimated' : 'Recorded'} color="text-blue-600" />
            </div>
            {keyMessage && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-700">{keyMessage}</div>}
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-gray-900">Error Logs</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Latest controlled or detected server-side infrastructure errors.</p>
              </div>
              <button type="button" onClick={() => fetchInfrastructureData({ quiet: true })} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold">Refresh Logs</button>
            </div>

            {latestError && (
              <div className="rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4">
                <p className="text-[10px] uppercase font-black text-red-500 tracking-wider">Latest Error</p>
                <p className="text-sm font-black text-red-800 mt-1">{latestError.code}: {latestError.message}</p>
              </div>
            )}

            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-xs font-bold text-gray-400">No server error-log entries are currently available.</div>
              ) : logs.map(log => (
                <article key={log.id} className="border border-gray-100 rounded-2xl px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-900 truncate">{log.context || 'Server'} · {log.code || 'ERROR'}</p>
                      <p className="text-xs text-gray-700 mt-1 break-words">{log.message}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold flex-shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Server log'}</span>
                  </div>
                  {log.details && <p className="text-[10px] text-gray-400 mt-2 break-words">{log.details}</p>}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {exportOpen && (
        <Modal title="Export System Performance Report" onClose={() => !exporting && setExportOpen(false)}>
          <p className="text-xs text-gray-500 mb-4">The latest server data will be retrieved again when you confirm the export.</p>
          <div className="grid grid-cols-2 gap-3">
            <FormatOption active={exportFormat === 'pdf'} title="PDF" subtitle="Portable document .pdf" onClick={() => setExportFormat('pdf')} />
            <FormatOption active={exportFormat === 'csv'} title="CSV" subtitle="Spreadsheet-compatible .csv" onClick={() => setExportFormat('csv')} />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" disabled={exporting} onClick={() => setExportOpen(false)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">Cancel</button>
            <button type="button" disabled={exporting} onClick={confirmExport} className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-50">{exporting ? 'Exporting...' : 'Confirm Export'}</button>
          </div>
        </Modal>
      )}

      {keyOpen && (
        <Modal title="Update API Key" onClose={() => !keySaving && setKeyOpen(false)}>
          <label className="block text-xs font-bold text-gray-700 mb-2" htmlFor="backup-api-key">Backup LLM API Key</label>
          <input id="backup-api-key" type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Enter backup API key" className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${keyError ? 'border-red-400' : 'border-gray-200 focus:border-indigo-400'}`} />
          {keyError && <p className="text-xs font-bold text-red-600 mt-2">{keyError}</p>}
          {keyMessage && <p className="text-xs font-bold text-emerald-600 mt-2">{keyMessage}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" disabled={keySaving} onClick={() => setKeyOpen(false)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">Cancel</button>
            <button type="button" disabled={keySaving} onClick={confirmApiKeyUpdate} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">{keySaving ? 'Updating...' : 'Confirm'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HealthSummaryCard({ label, value, detail }) {
  return <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs"><p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p><p className="text-2xl font-black text-gray-900 mt-2">{value}</p><p className="text-[11px] text-gray-500 mt-1">{detail}</p></div>;
}

function TabButton({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{children}</button>;
}

function StatCard({ label, value, color }) {
  return <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs"><p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p><p className={`text-3xl font-black mt-3 ${color || 'text-gray-900'}`}>{value}</p></div>;
}

function StatBoxMini({ label, value, color }) {
  return <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 text-center"><p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p><p className={`text-lg font-black mt-1 ${color || 'text-gray-900'}`}>{value}</p></div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between gap-4 mb-5"><h2 className="text-base font-black text-gray-900">{title}</h2><button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

function FormatOption({ active, title, subtitle, onClick }) {
  return <button type="button" onClick={onClick} className={`text-left rounded-2xl border p-4 transition ${active ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}><p className="text-sm font-black text-gray-900">{title}</p><p className="text-[10px] text-gray-500 mt-1">{subtitle}</p></button>;
}
