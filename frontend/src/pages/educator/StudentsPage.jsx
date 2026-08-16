import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCourses } from '../../features/classroom/courseApi';
import { getCourseMembers } from '../../features/classroom/enrollmentApi';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
}

export default function StudentsPage() {
  const [courses, setCourses] = useState([]);
  const [memberEntries, setMemberEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    async function loadStudents() {
      try {
        setLoading(true); setLoadError('');
        const courseResult = await getCourses();
        const loadedCourses = Array.isArray(courseResult?.courses) ? courseResult.courses : [];
        const membershipGroups = await Promise.all(
          loadedCourses.map(async (course) => {
            const result = await getCourseMembers(course.courseId).catch(() => ({ members: [] }));
            const members = Array.isArray(result?.members) ? result.members : [];
            return members.map((member) => ({
              course,
              enrollment: member.enrollment || member,
              learner: member.learner || member.user || null
            }));
          })
        );

        if (cancelled) return;
        setCourses(loadedCourses);
        setMemberEntries(membershipGroups.flat());
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Unable to load students.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStudents();
    return () => { cancelled = true; };
  }, []);

  const learnerRows = useMemo(() => {
    const learnerMap = new Map();
    memberEntries
      .filter(({ enrollment }) => enrollment.status === 'APPROVED')
      .forEach(({ course, enrollment, learner }) => {
        const lId = String(learner?.userId ?? learner?.id ?? enrollment.learnerId);
        if (!learnerMap.has(lId)) {
          learnerMap.set(lId, {
            learner: learner || { userId: enrollment.learnerId, displayName: 'Unknown Learner', email: 'N/A', avatarUrl: null },
            courses: []
          });
        }
        learnerMap.get(lId).courses.push({
          courseId: course.courseId,
          subjectName: course.subjectName,
          courseCode: course.courseCode
        });
      });
    return Array.from(learnerMap.values()).sort((a, b) => 
      String(a.learner.displayName || '').localeCompare(String(b.learner.displayName || ''))
    );
  }, [memberEntries]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return learnerRows.filter(({ learner, courses: learnerCourses }) => {
      if (selectedCourseId !== 'ALL') {
        const belongs = learnerCourses.some((c) => String(c.courseId) === String(selectedCourseId));
        if (!belongs) return false;
      }
      if (!term) return true;
      const name = (learner.displayName || learner.fullname || '').toLowerCase();
      const email = (learner.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [learnerRows, searchTerm, selectedCourseId]);

  const activeCourses = useMemo(() => courses.filter((c) => c.status === 'ACTIVE'), [courses]);
  const totalApproved = useMemo(() => memberEntries.filter((e) => e.enrollment.status === 'APPROVED').length, [memberEntries]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-gray-500">Loading student directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
      {/* HEADER */}
      <header className="min-h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Student Directory</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">View enrolled students across all active courses.</p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {loadError && <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">{loadError}</div>}

        {/* METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <SummaryCard label="Unique Students" value={learnerRows.length} />
          <SummaryCard label="Approved Enrollments" value={totalApproved} />
          <SummaryCard label="Active Classes" value={activeCourses.length} />
        </div>

        {/* FILTERS */}
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Search Student</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-xs font-semibold text-gray-800 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Filter by Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-xs font-semibold text-gray-800 bg-gray-50 hover:bg-white focus:bg-white outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value="ALL">All Courses</option>
                {activeCourses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>{c.subjectName} ({c.courseCode})</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* TABLE */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-base font-black text-gray-900">Enrolled Students List</h2>
            <span className="text-xs bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full">{filteredRows.length} students</span>
          </div>

          {filteredRows.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold text-gray-400">No students match the selected filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4">Enrolled Courses</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-semibold text-gray-700">
                  {filteredRows.map(({ learner, courses: lCourses }) => {
                    const lId = learner.userId ?? learner.id;
                    return (
                      <tr key={lId} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4"><LearnerIdentity learner={learner} /></td>
                        <td className="px-6 py-4 text-gray-500">{learner.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {lCourses.map((c) => (
                              <Link key={c.courseId} to={`/educator/courses/${c.courseId}`} className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-lg transition">
                                {c.subjectName} ({c.courseCode})
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {lCourses.length === 1 ? (
                            <Link to={`/educator/courses/${lCourses[0].courseId}/members`} className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition shadow-xs">
                              Manage Membership
                            </Link>
                          ) : (
                            <span className="text-gray-400 font-medium">{lCourses.length} courses</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
      <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{label}</p>
      <p className="text-3xl font-black text-gray-900 mt-3">{value}</p>
    </div>
  );
}

function LearnerIdentity({ learner }) {
  const name = learner.displayName || learner.fullname || 'Unknown Student';
  return (
    <div className="flex items-center gap-3">
      {learner.avatarUrl ? (
        <img src={learner.avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs border border-blue-100">
          {getInitials(name)}
        </div>
      )}
      <div>
        <p className="text-xs font-bold text-gray-900">{name}</p>
        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Active Student</p>
      </div>
    </div>
  );
}