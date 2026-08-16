// frontend/src/pages/educator/StudentAnalyticsPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { apiRequest } from '../../services/apiClient';
import {
  getClassPerformance,
  getWeeklyClassPerformance
} from '../../services/analyticsService';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const SCORE_BUCKET_LABELS = ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'];

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

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildExportSections(data, course, weeklyMetadata = null) {
  const sections = [];
  sections.push(['Class Performance Statistics']);
  sections.push(['Course', `${course?.subjectName || data?.course?.subjectName || ''} (${course?.courseCode || data?.course?.courseCode || ''})`]);
  if (weeklyMetadata) {
    sections.push(['Report Type', 'Weekly Class Performance']);
    sections.push(['Generated At', new Date(weeklyMetadata.generatedAt).toLocaleString()]);
    sections.push(['Period', `${new Date(weeklyMetadata.periodStart).toLocaleDateString()} - ${new Date(weeklyMetadata.periodEnd).toLocaleDateString()}`]);
  }
  sections.push(['Class Average Score', data?.avgAssessmentScore || '—']);
  sections.push(['Total Students', data?.totalStudents ?? 0]);
  sections.push(['Total Graded Submissions', data?.totalGradedSubmissions ?? 0]);
  sections.push(['Active Study Time', data?.activeStudyTime || '0.0 hrs']);
  sections.push([]);

  sections.push(['Score Distribution']);
  sections.push(['Range', 'Submission Count']);
  SCORE_BUCKET_LABELS.forEach((label, index) => {
    sections.push([label, data?.distributionCounts?.[index] ?? 0]);
  });
  sections.push([]);

  sections.push(['Learner Performance']);
  sections.push(['Learner', 'Email', 'Average Score', 'Graded Submissions', 'Study Time (mins)', 'Status']);
  (data?.learnerPerformance || []).forEach((learner) => {
    sections.push([
      learner.name,
      learner.email,
      learner.averageScore == null ? '—' : `${learner.averageScore}%`,
      learner.gradedSubmissions ?? 0,
      learner.studyTimeMinutes ?? 0,
      learner.needsAttention ? `Needs Attention: ${learner.reason || ''}` : 'On Track'
    ]);
  });
  sections.push([]);

  sections.push(['Students Requiring Attention']);
  sections.push(['Learner', 'Average Score', 'Study Time (mins)', 'Reason']);
  if ((data?.atRiskStudents || []).length === 0) {
    sections.push(['None']);
  } else {
    data.atRiskStudents.forEach((learner) => {
      sections.push([
        learner.name,
        learner.averageScore == null ? '—' : `${learner.averageScore}%`,
        learner.studyTimeMinutes ?? 0,
        learner.reason || ''
      ]);
    });
  }
  sections.push([]);

  sections.push(['Class-wide Knowledge Gaps']);
  sections.push(['Assessment', 'Class Average']);
  if ((data?.knowledgeGaps || []).length === 0) {
    sections.push(['No class-wide knowledge gaps identified.']);
  } else {
    data.knowledgeGaps.forEach((gap) => {
      sections.push([gap.assessmentTitle, `${gap.averageScorePercent}%`]);
    });
  }
  sections.push([]);

  sections.push(['Performance Trends']);
  sections.push(['Date', 'Active Study Time (mins)', 'Average Official Assessment Score', 'Graded Submissions']);
  (data?.performanceTrends || []).forEach((point) => {
    sections.push([
      point.date,
      point.studyTimeMinutes ?? 0,
      point.averageScore == null ? '—' : `${point.averageScore}%`,
      point.gradedSubmissions ?? 0
    ]);
  });

  return sections;
}

function columnName(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function createStoredZip(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  const entries = [];
  let localOffset = 0;

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(content);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034B50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true); // stored, no compression
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, dataBytes);
    entries.push({ nameBytes, dataBytes, checksum, localOffset });
    localOffset += localHeader.length + dataBytes.length;
  });

  entries.forEach((entry) => {
    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, entry.checksum, true);
    centralView.setUint32(20, entry.dataBytes.length, true);
    centralView.setUint32(24, entry.dataBytes.length, true);
    centralView.setUint16(28, entry.nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, entry.localOffset, true);
    centralHeader.set(entry.nameBytes, 46);
    centralChunks.push(centralHeader);
  });

  const localBytes = concatBytes(localChunks);
  const centralBytes = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localBytes.length, true);
  endView.setUint16(20, 0, true);

  return concatBytes([localBytes, centralBytes, end]);
}

function createExcelBlob(rows) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Class Performance" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
    }
  ];

  const zipBytes = createStoredZip(files);
  return new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
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
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxLength) {
      current = `${current} ${word}`;
    } else {
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
  const logicalLines = rows.flatMap((row) => {
    if (row.length === 0) return [''];
    return wrapPdfLine(row.join(' | '));
  });

  const linesPerPage = 48;
  const pages = [];
  for (let i = 0; i < logicalLines.length; i += linesPerPage) {
    pages.push(logicalLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['Class Performance Statistics']);

  const fontId = 3 + (pages.length * 2);
  const objects = new Array(fontId + 1);
  const pageIds = pages.map((_, index) => 3 + (index * 2));

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  pages.forEach((pageLines, index) => {
    const pageId = 3 + (index * 2);
    const contentId = pageId + 1;
    const content = [
      'BT',
      '/F1 9 Tf',
      '48 790 Td',
      '12 TL',
      ...pageLines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, 'T*']),
      'ET'
    ].join('\n');

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
  pdf += `xref\n0 ${fontId + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id <= fontId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export default function StudentAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || '';
  const weeklyMode = searchParams.get('weekly') === '1';

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [weeklyMetadata, setWeeklyMetadata] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');

  useEffect(() => {
    let cancelled = false;
    async function loadCourses() {
      try {
        setLoadingCourses(true);
        const res = await apiRequest('/courses', { method: 'GET' });
        const list = Array.isArray(res?.courses) ? res.courses : Array.isArray(res) ? res : [];
        if (cancelled) return;
        setCourses(list);

        if (!initialCourseId && list.length > 0) {
          const firstCourseId = String(list[0].courseId);
          setSelectedCourseId(firstCourseId);
          setSearchParams({ courseId: firstCourseId }, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setErrorMessage('Failed to load courses.');
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }
    loadCourses();
    return () => { cancelled = true; };
    // initialCourseId is intentionally captured from the initial URL only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    let cancelled = false;

    async function loadPerformance() {
      try {
        setLoadingStats(true);
        setErrorMessage(null);

        if (weeklyMode) {
          const report = await getWeeklyClassPerformance(selectedCourseId);
          if (cancelled) return;
          setAnalyticsData(report?.stats || null);
          setWeeklyMetadata(report || null);
        } else {
          const data = await getClassPerformance(selectedCourseId);
          if (cancelled) return;
          setAnalyticsData(data);
          setWeeklyMetadata(null);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err.message || 'Failed to load analytics.');
          setAnalyticsData(null);
          setWeeklyMetadata(null);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    loadPerformance();
    return () => { cancelled = true; };
  }, [selectedCourseId, weeklyMode]);

  const selectedCourse = useMemo(() => (
    courses.find((c) => String(c.courseId) === String(selectedCourseId)) || analyticsData?.course || null
  ), [courses, selectedCourseId, analyticsData]);

  const handleCourseChange = (event) => {
    const courseId = event.target.value;
    setSelectedCourseId(courseId);
    setSearchParams({ courseId });
  };

  const confirmExport = () => {
    if (!analyticsData || !selectedCourse) return;
    const rows = buildExportSections(analyticsData, selectedCourse, weeklyMetadata);
    const safeCode = String(selectedCourse.courseCode || selectedCourse.courseId || 'course').replace(/[^A-Za-z0-9_-]/g, '_');
    const prefix = weeklyMetadata ? 'Weekly_Class_Performance' : 'Class_Performance';

    if (exportFormat === 'excel') {
      downloadBlob(createExcelBlob(rows), `${prefix}_${safeCode}.xlsx`);
    } else {
      downloadBlob(createPdfBlob(rows), `${prefix}_${safeCode}.pdf`);
    }
    setExportDialogOpen(false);
  };

  const safeCount = analyticsData?.performanceRatio?.safeCount ?? 0;
  const atRiskCount = analyticsData?.performanceRatio?.atRiskCount ?? 0;
  const hasStudents = safeCount + atRiskCount > 0;

  const doughnutData = {
    labels: ['Safe / Passing', 'Needs Attention'],
    datasets: [{
      data: hasStudents ? [safeCount, atRiskCount] : [1, 0],
      backgroundColor: hasStudents ? ['#10B981', '#EF4444'] : ['#E5E7EB', '#E5E7EB'],
      borderWidth: 0
    }]
  };

  const distributionCounts = analyticsData?.distributionCounts || [0, 0, 0, 0, 0];
  const barData = {
    labels: SCORE_BUCKET_LABELS,
    datasets: [{
      label: 'Submissions',
      data: distributionCounts,
      backgroundColor: '#3B82F6',
      borderRadius: 8
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10, weight: 'bold' }, color: '#9CA3AF' }, grid: { color: '#F3F4F6' } },
      x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              {weeklyMode ? 'Weekly Class Performance Insights' : 'Class Performance Statistics'}
            </h1>
            {weeklyMode && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">
                Weekly Report
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Class-scoped official assessment performance and active study-time information.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExportDialogOpen(true)}
          disabled={!analyticsData || loadingStats}
          className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50"
        >
          Export
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Select Course</label>
          {loadingCourses ? (
            <p className="text-xs text-gray-400 font-semibold">Loading courses...</p>
          ) : courses.length === 0 ? (
            <p className="text-xs text-gray-500 font-semibold">No managed courses available.</p>
          ) : (
            <select
              value={selectedCourseId}
              onChange={handleCourseChange}
              className="w-full text-xs font-bold text-gray-900 bg-gray-50 border border-gray-200 p-3.5 rounded-2xl outline-none focus:border-blue-600 focus:bg-white transition shadow-xs cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.subjectName} ({c.courseCode})
                </option>
              ))}
            </select>
          )}
          <p className="text-[10px] text-gray-400 mt-2">
            Only classes managed by the signed-in Educator are available here.
          </p>
        </section>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
            {errorMessage}
          </div>
        )}

        {loadingStats && (
          <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl text-xs font-bold">
            Loading class performance statistics...
          </div>
        )}

        {weeklyMetadata && selectedCourse && (
          <section className="bg-purple-50 rounded-3xl border border-purple-100 p-5 shadow-xs">
            <p className="text-xs font-black text-purple-900">Automated Weekly Report</p>
            <p className="text-[11px] text-purple-700 mt-1">
              Generated {new Date(weeklyMetadata.generatedAt).toLocaleString()} · Period {new Date(weeklyMetadata.periodStart).toLocaleDateString()} – {new Date(weeklyMetadata.periodEnd).toLocaleDateString()}
            </p>
          </section>
        )}

        {selectedCourse && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900">{selectedCourse.subjectName}</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-semibold">{selectedCourse.courseCode}</p>
            </div>
            <Link to={`/educator/courses/${selectedCourse.courseId}`} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition shadow-xs">
              View Course Hub
            </Link>
          </div>
        )}

        {analyticsData && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatBox label="Total Students" value={analyticsData.totalStudents ?? 0} helper="Approved enrollments" />
              <StatBox label="Avg Assessment Score" value={analyticsData.avgAssessmentScore || '—'} helper="Official graded scores" color="text-blue-600" />
              <StatBox label="Active Study Time" value={analyticsData.activeStudyTime || '0.0 hrs'} helper="Class Project study activity" color="text-emerald-600" />
              <StatBox label="Graded Submissions" value={analyticsData.totalGradedSubmissions ?? 0} helper="Official assessments only" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Performance Ratio</h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">Safe vs learners requiring attention.</p>
                </div>
                <div className="h-64 flex items-center justify-center pt-4">
                  <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' } } } } }} />
                </div>
              </div>

              <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Score Distribution</h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">Official graded assessment score spread.</p>
                </div>
                <div className="h-64 pt-4">
                  <Bar data={barData} options={barOptions} />
                </div>
              </div>
            </div>

            <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50">
                <h3 className="text-base font-black text-gray-900">Learner Performance</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Permitted class-scoped performance and Class Project study time only.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-6 py-3">Learner</th>
                      <th className="px-6 py-3">Average Score</th>
                      <th className="px-6 py-3">Graded</th>
                      <th className="px-6 py-3">Active Study Time</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(analyticsData.learnerPerformance || []).map((learner) => (
                      <tr key={learner.learnerId} className="text-xs">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{learner.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{learner.email}</p>
                        </td>
                        <td className="px-6 py-4 font-black text-gray-800">{learner.averageScore == null ? '—' : `${learner.averageScore}%`}</td>
                        <td className="px-6 py-4 text-gray-600">{learner.gradedSubmissions ?? 0}</td>
                        <td className="px-6 py-4 text-gray-600">{learner.studyTimeMinutes ?? 0} mins</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${learner.needsAttention ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {learner.needsAttention ? 'Needs Attention' : 'On Track'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(analyticsData.learnerPerformance || []).length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-10 text-center text-xs font-semibold text-gray-400">No approved Learners in this class.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-amber-50/60 rounded-3xl border border-amber-200 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">Class-wide Knowledge Gaps</h3>
              {(analyticsData.knowledgeGaps || []).length === 0 ? (
                <p className="text-xs text-amber-700">No class-wide knowledge gaps identified from the current official assessment data.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {analyticsData.knowledgeGaps.map((gap, idx) => (
                    <div key={`${gap.assessmentTitle}-${idx}`} className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs">
                      <p className="text-xs font-bold text-gray-900 truncate">{gap.assessmentTitle}</p>
                      <p className="text-xs font-black text-red-600 mt-1">Average: {gap.averageScorePercent}%</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50">
                <h3 className="text-base font-black text-gray-900">Performance Trends</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Recent class activity and official assessment results.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Study Time</th>
                      <th className="px-6 py-3">Average Score</th>
                      <th className="px-6 py-3">Graded Submissions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(analyticsData.performanceTrends || []).map((point) => (
                      <tr key={point.date} className="text-xs text-gray-700">
                        <td className="px-6 py-3 font-bold">{new Date(`${point.date}T00:00:00`).toLocaleDateString()}</td>
                        <td className="px-6 py-3">{point.studyTimeMinutes} mins</td>
                        <td className="px-6 py-3">{point.averageScore == null ? '—' : `${point.averageScore}%`}</td>
                        <td className="px-6 py-3">{point.gradedSubmissions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-gray-900">Students Requiring Attention</h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">Low official-assessment performance or missing submissions.</p>
                </div>
                <span className="text-xs bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full">
                  {analyticsData.atRiskStudents?.length || 0} students
                </span>
              </div>

              <div className="p-6">
                {!analyticsData.atRiskStudents || analyticsData.atRiskStudents.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-gray-400">
                    All students are currently meeting expectations.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {analyticsData.atRiskStudents.map((student) => (
                      <div key={student.learnerId} className="py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{student.name}</p>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{student.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-black text-red-600">Avg: {student.averageScore == null ? '—' : `${student.averageScore}%`}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{student.studyTimeMinutes} mins studied</p>
                          </div>
                          <span className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-xl font-bold">
                            {student.reason}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {exportDialogOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6">
            <h2 className="text-base font-black text-gray-900">Export Class Performance Statistics</h2>
            <p className="text-xs text-gray-500 mt-1">Choose a format. The export contains only the selected class-scoped statistics shown on this report.</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat('excel')}
                className={`p-4 rounded-2xl border text-left transition ${exportFormat === 'excel' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
              >
                <p className="text-sm font-black text-gray-900">Excel</p>
                <p className="text-[10px] text-gray-500 mt-1">Microsoft Excel .xlsx</p>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`p-4 rounded-2xl border text-left transition ${exportFormat === 'pdf' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}
              >
                <p className="text-sm font-black text-gray-900">PDF</p>
                <p className="text-[10px] text-gray-500 mt-1">Portable Document Format</p>
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setExportDialogOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button type="button" onClick={confirmExport} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-800">
                Confirm Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, helper, color }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
      <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p>
      <p className={`text-3xl font-black mt-3 ${color || 'text-gray-900'}`}>{value}</p>
      <p className="text-[11px] text-gray-400 font-medium mt-1">{helper}</p>
    </div>
  );
}
