import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAssessments } from '../../services/assessmentService';

export default function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        const data = await getAssessments();
        setAssessments(Array.isArray(data) ? data : data.assessments || []);
      } catch (err) {
        console.error("Lỗi API assessments:", err);
        setErrorMsg("Không thể tải danh sách bài kiểm tra.");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-gray-50"><p className="text-gray-500">Đang đồng bộ dữ liệu...</p></div>;

  return (
    <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Official Assessments</h1>
        <p className="text-xs text-gray-400 mt-1">Bài tập và kiểm tra chính thức từ Giáo viên.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assessments.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 py-10">Chưa có bài kiểm tra nào.</p>
        ) : (
          assessments.map((asmt) => (
            <div key={asmt.assessmentId || asmt.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors">
              <div>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full uppercase">
                  {asmt.type || 'QUIZ'}
                </span>
                <h3 className="text-base font-bold text-gray-800 mt-3 mb-1 line-clamp-2">{asmt.title}</h3>
                <p className="text-xs text-gray-500 mb-2">Điểm tối đa: {asmt.totalPoints || 100}</p>
                <p className="text-[11px] text-gray-400 mb-4 line-clamp-3">{asmt.description || 'Không có mô tả.'}</p>
              </div>
              
              <button 
                onClick={() => navigate(`/learner/quizzes?id=${asmt.assessmentId || asmt.id}`)}
                className="w-full mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm"
              >
                Vào Phòng Thi
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}