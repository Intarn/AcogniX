// frontend/src/services/progressService.js
import { apiRequest } from './apiClient';

const USERS_KEY = 'acognix_users';
const COURSES_KEY = 'acognix_courses';
const FLASHCARDS_KEY = 'acognix_flashcards';
const QUIZZES_KEY = 'acognix_quizzes';
const NOTES_KEY = 'acognix_notes';

// Lấy toàn bộ tổng quan tiến độ học tập (GET /api/progress/overview)
export const getProgressOverview = async (userEmail, timeRange = 'Last 7 days') => {
  try {
    return await apiRequest(`/progress/overview?timeRange=${encodeURIComponent(timeRange)}`, { method: 'GET' });
  } catch (error) {
    // Dự phòng tính toán dữ liệu LocalStorage khi Backend chưa triển khai endpoint
    const allUsers = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    const allCourses = JSON.parse(localStorage.getItem(COURSES_KEY)) || [];
    const allFlashcards = JSON.parse(localStorage.getItem(FLASHCARDS_KEY)) || [];
    const allQuizzes = JSON.parse(localStorage.getItem(QUIZZES_KEY)) || [];
    const allNotes = JSON.parse(localStorage.getItem(NOTES_KEY)) || [];

    const fullCurrentUser = allUsers.find(u => u.email === userEmail);
    const enrolledCourseIds = fullCurrentUser ? fullCurrentUser.enrolledCourses || [] : [];

    const myCourses = allCourses.filter(course => enrolledCourseIds.includes(course.id));
    const myFlashcards = allFlashcards.filter(fc => fc.userId === userEmail);
    const myNotes = allNotes.filter(note => note.userId === userEmail);
    const myQuizzesTaken = allQuizzes.filter(q => q.results && q.results[userEmail]);

    // 1. Metrics
    const estimatedMinutes = (myQuizzesTaken.length * 15) + (myNotes.length * 10) + (myFlashcards.length * 2);
    const timeStudied = `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`;
    const flashcardsReviewed = myFlashcards.filter(fc => fc.status !== 'new').length;
    const quizzesPassed = myQuizzesTaken.filter(q => q.results[userEmail].score >= 70).length;

    // 2. Activity Feed
    let actList = [];
    myQuizzesTaken.forEach(q => {
      actList.push({
        type: 'quiz',
        title: `Scored ${q.results[userEmail].score}% on "${q.title}"`,
        dateObj: new Date(q.results[userEmail].date),
        icon: '🧠',
        bgClass: 'bg-blue-100 text-blue-600'
      });
    });

    myNotes.forEach(n => {
      actList.push({
        type: 'note',
        title: `Created note: "${n.title || 'Untitled'}"`,
        dateObj: new Date(n.date),
        icon: '📝',
        bgClass: 'bg-purple-100 text-purple-600'
      });
    });

    actList.sort((a, b) => b.dateObj - a.dateObj);
    const activities = actList.slice(0, 6);

    // 3. Tiến độ khóa học
    let coursesCompleted = 0;
    const courseProgressList = myCourses.map(course => {
      const courseQuizzes = allQuizzes.filter(q => q.courseId === course.id);
      let progress = 0;

      if (courseQuizzes.length > 0) {
        const passedCourseQuizzes = courseQuizzes.filter(q => q.results && q.results[userEmail] && q.results[userEmail].score >= 70).length;
        progress = Math.round((passedCourseQuizzes / courseQuizzes.length) * 100);
      }

      if (progress === 100) coursesCompleted++;

      let progressColor = 'bg-emerald-500';
      let textColor = 'text-emerald-600';
      if (progress < 70) { progressColor = 'bg-amber-500'; textColor = 'text-amber-600'; }
      if (progress === 0) { progressColor = 'bg-gray-300'; textColor = 'text-gray-500'; }

      return { ...course, progress, progressColor, textColor };
    });

    // 4. Biểu đồ 7 ngày
    const labels = [];
    const dataArray = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

      const dateStrToMatch = d.toISOString().split('T')[0];
      let minsInDay = 0;
      actList.forEach(act => {
        if (act.dateObj.toISOString().split('T')[0] === dateStrToMatch) {
          if (act.type === 'quiz') minsInDay += 15;
          if (act.type === 'note') minsInDay += 10;
        }
      });
      dataArray.push(Number((minsInDay / 60).toFixed(1)));
    }

    return {
      timeStudied,
      coursesCompleted,
      flashcardsReviewed,
      quizzesPassed,
      activities,
      courseProgressList,
      chartData: { labels, data: dataArray }
    };
  }
};