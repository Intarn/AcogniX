import { useNavigate, useParams } from 'react-router';

export default function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <button onClick={() => navigate('/admin/courses')} className="text-sm font-medium text-gray-500 hover:text-gray-800 mr-2">Courses</button>
          <span className="text-sm font-medium text-gray-400 mx-2">/</span>
          <h1 className="inline-block text-lg font-bold text-gray-800">Course {courseId} Details</h1>
        </div>
        <button className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm border border-red-200">
          Force Archive
        </button>
      </header>

      <main className="p-6 overflow-y-auto">
        {/* Course Info Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800">Intro to Computer Science (CS101)</h2>
          <p className="text-sm text-gray-500 mt-1">Educator: Nguyen Van A</p>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Enrolled Students (Mock)</h3>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-6 py-3">Student Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">Student list will be loaded here</td></tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}