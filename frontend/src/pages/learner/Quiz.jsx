// frontend/src/pages/learner/Quiz.jsx
import { useState, useEffect } from 'react';
import {
  Link,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { 
  getOpenAssessment, 
  startSubmission, 
  saveAnswer, 
  submitSubmissionAPI 
} from '../../services/quizService';


export default function Quiz() {
  const [searchParams] = useSearchParams();
  const assessmentId = searchParams.get('id');

  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [submission, setSubmission] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Dùng Object để map questionId -> response
  const [userAnswers, setUserAnswers] = useState({});
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // 1. Khởi tạo bài thi & Tạo phiên làm bài
  useEffect(() => {
    const initializeQuiz =
      async () => {

      if (!assessmentId) {
        setLoading(false);
        return;
      }


      try {
        setLoading(true);

        setErrorMsg(null);


        /*
        * Lấy Assessment
        * và Questions.
        */
        const {
          assessment: asmt,
          questions: qs
        } =
          await getOpenAssessment(
            assessmentId
          );


        setAssessment(
          asmt
        );


        setQuestions(
          qs || []
        );


        /*
        * Tạo / lấy Submission.
        */
        try {
          const subRes =
            await startSubmission(
              assessmentId
            );


          setSubmission(
            subRes.submission
          );

        } catch (
          submissionError
        ) {

          /*
          * Learner đã submit
          * Assessment này rồi.
          */
          if (
            submissionError.code ===
            'ASSESSMENT_ALREADY_SUBMITTED'
          ) {
            navigate(
              `/learner/courses/${asmt.courseId}/assessments/${assessmentId}/review`,
              {
                replace: true
              }
            );

            return;
          }


          throw submissionError;
        }

      } catch (err) {
        console.error(
          'Lỗi khởi tạo Quiz:',
          err
        );


        setErrorMsg(
          err.message ||
          'Không thể tải bài kiểm tra. Có thể bài chưa mở hoặc bạn không có quyền.'
        );

      } finally {
        setLoading(false);
      }
    };


    initializeQuiz();

  }, [
    assessmentId,
    navigate
  ]);

  // 2. Xử lý khi chọn đáp án (Lưu nháp ngay lập tức)
  const handleSelectOption = async (questionId, optionContent) => {
    if (!submission || isCompleted || savingAnswer) return;

    // Cập nhật UI ngay lập tức cho mượt
    setUserAnswers(prev => ({ ...prev, [questionId]: optionContent }));

    try {
      setSavingAnswer(true);
      await saveAnswer(submission.submissionId, questionId, optionContent);
    } catch (err) {
      alert("Lỗi mạng khi lưu đáp án. Vui lòng chọn lại!");
      // Hoàn tác UI nếu lưu xịt
      setUserAnswers(prev => {
        const newState = { ...prev };
        delete newState[questionId];
        return newState;
      });
    } finally {
      setSavingAnswer(false);
    }
  };

  // 3. Xử lý nộp bài
  const handleFinishQuiz = async () => {
    if (!submission) return;
    try {
      setSubmitting(true);
      const res = await submitSubmissionAPI(submission.submissionId);
      
      // Backend auto-grade sẽ trả về score
      setFinalScore(res.submission.score);
      setIsCompleted(true);
    } catch (err) {
      alert("Lỗi khi nộp bài: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="flex-1 flex items-center justify-center p-6 bg-gray-50"><p className="text-gray-500 font-bold">Đang tải bài thi...</p></main>;
  }

  if (errorMsg || !assessment || questions.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-gray-100/30">
        <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-lg mx-auto">
          <h2 className="text-2xl font-black text-gray-800 mb-3">Quiz Not Available</h2>
          <p className="text-gray-500 mb-8">{errorMsg || "Bài kiểm tra không tồn tại hoặc không có câu hỏi."}</p>
          <Link to="/learner/my-courses" className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 inline-block">Back to Courses</Link>
        </div>
      </main>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-gray-100/30 overflow-y-auto w-full">
      {!isCompleted ? (
        <div className="w-full max-w-4xl mx-auto">
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-gray-800">{assessment.title}</h2>
              <p className="text-sm font-semibold text-gray-500">
                Question <span className="text-blue-600 font-bold">{currentIndex + 1}</span> of {totalQuestions}
              </p>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-8 flex flex-col h-full">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1 relative">
                
                {savingAnswer && <div className="absolute top-2 right-4 text-[10px] text-gray-400 italic">Đang lưu...</div>}
                
                <p className="text-lg font-semibold text-gray-800 mb-6">{currentQuestion.content}</p>
                <div className="space-y-3">
                  {currentQuestion.options?.map(
                    (option, idx) => {

                      /*
                      * Backend hiện tại có thể trả:
                      *
                      * [
                      *   '=',
                      *   '==',
                      *   '===',
                      *   '!='
                      * ]
                      *
                      * hoặc sau này có thể trả:
                      *
                      * [
                      *   {
                      *     optionId: '...',
                      *     content: '='
                      *   }
                      * ]
                      *
                      * Vì vậy frontend hỗ trợ cả 2.
                      */
                      const optionContent =
                        option &&
                        typeof option === 'object'
                          ? String(
                              option.content ?? ''
                            )
                          : String(
                              option ?? ''
                            );


                      const optionId =
                        option &&
                        typeof option === 'object'
                          ? (
                              option.optionId ||
                              `${currentQuestion.questionId}-option-${idx}`
                            )
                          : `${currentQuestion.questionId}-option-${idx}`;


                      const isSelected =
                        userAnswers[
                          currentQuestion.questionId
                        ] === optionContent;


                      return (
                        <label
                          key={optionId}
                          className={`
                            flex
                            items-center
                            gap-4
                            p-4
                            rounded-xl
                            border-2
                            cursor-pointer
                            transition-all

                            ${
                              isSelected
                                ? `
                                  border-blue-500
                                  bg-blue-50
                                `
                                : `
                                  border-gray-100
                                  hover:border-blue-200
                                `
                            }
                          `}
                        >
                          <input
                            type="radio"
                            name={
                              `quiz_${currentQuestion.questionId}`
                            }
                            checked={
                              isSelected
                            }
                            onChange={() =>
                              handleSelectOption(
                                currentQuestion.questionId,
                                optionContent
                              )
                            }
                            className="hidden"
                          />


                          <span
                            className={`
                              w-6
                              h-6
                              border-2
                              rounded-full
                              flex
                              items-center
                              justify-center
                              flex-shrink-0

                              ${
                                isSelected
                                  ? `
                                    bg-blue-500
                                    border-blue-500
                                  `
                                  : `
                                    border-gray-300
                                  `
                              }
                            `}
                          >
                            <span
                              className={`
                                w-2
                                h-2
                                bg-white
                                rounded-full

                                ${
                                  isSelected
                                    ? 'block'
                                    : 'hidden'
                                }
                              `}
                            />
                          </span>


                          <span
                            className="
                              text-sm
                              font-medium
                              text-gray-700
                            "
                          >
                            {optionContent}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <button 
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  disabled={savingAnswer || submitting}
                  onClick={() => {
                    if (currentIndex < totalQuestions - 1) {
                      setCurrentIndex(prev => prev + 1);
                    } else {
                      const unanswered = totalQuestions - answeredCount;
                      let msg = "Bạn chắc chắn muốn nộp bài?";
                      if (unanswered > 0) msg = `Bạn còn ${unanswered} câu chưa làm. Vẫn nộp bài?`;
                      if (confirm(msg)) handleFinishQuiz();
                    }
                  }}
                  className={`px-5 py-2.5 text-sm font-bold text-white rounded-lg ${currentIndex === totalQuestions - 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
                >
                  {submitting ? 'Submitting...' : (currentIndex === totalQuestions - 1 ? 'Finish Quiz' : 'Next')}
                </button>
              </div>
            </div>
            
            <div className="col-span-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase">Tiến độ</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-500">Đã trả lời</span>
                  <span className="font-bold text-blue-600">{answeredCount} / {totalQuestions}</span>
                </div>
                <div className="flex justify-between items-center text-xs p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-500">Điểm tối đa</span>
                  <span className="font-bold text-gray-800">{assessment.totalPoints}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden text-center">
          <div className="bg-blue-600 p-8 text-white">
            <h2 className="text-3xl font-black mb-2">Hoàn thành bài thi!</h2>
            <p className="text-blue-100">Dữ liệu đã được lưu trữ an toàn trên hệ thống.</p>
          </div>
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 rounded-full border-8 border-blue-100 flex items-center justify-center">
                <span className="text-4xl font-black text-blue-600">{finalScore !== null ? finalScore : '?'}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 font-bold uppercase mb-8">Điểm Của Bạn</p>
            <div
              className="
                flex
                items-center
                justify-center
                gap-3
                flex-wrap
              "
            >
              {/* VIEW REVIEW */}
              <Link
                to={
                  `/learner/courses/${assessment.courseId}/assessments/${assessment.assessmentId}/review`
                }
                className="
                  px-6
                  py-3
                  text-sm
                  font-bold
                  text-white
                  bg-blue-600
                  rounded-lg
                  hover:bg-blue-700
                  transition
                "
              >
                View Review
              </Link>


              {/* BACK TO ASSESSMENTS */}
              <Link
                to={
                  `/learner/courses/${assessment.courseId}/assessments`
                }
                className="
                  px-6
                  py-3
                  text-sm
                  font-bold
                  text-gray-600
                  bg-gray-100
                  rounded-lg
                  hover:bg-gray-200
                  transition
                "
              >
                Back to Assessments
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}