// frontend/src/routes/router.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  educatorRoutes
} from './educator.routes.jsx';

import CommunityPage from "../pages/shared/CommunityPage";
import {
  adminRoutes
} from './admin.routes.jsx';
// Layouts
import AuthLayout from "../layouts/AuthLayout";
import LearnerLayout from "../layouts/LearnerLayout";

import AssignmentSubmission
  from "../pages/learner/AssignmentSubmission";


// Protected Route Component
import ProtectedRoute from "./ProtectedRoute";

// Common Pages
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Settings from "../pages/auth/Settings";
// Bạn nên tạo một trang 404 chung, ví dụ:
// import NotFoundPage from '../pages/NotFoundPage';

// Learner Pages
import Dashboard from "../pages/learner/Dashboard";
import AIWorkspace from "../pages/learner/AIWorkspace";
import MyCourses from "../pages/learner/MyCourses";
import Quiz from "../pages/learner/Quiz";
import Assessments from "../pages/learner/Assessments";
import Notes from "../pages/learner/Notes";
import CourseDetail from "../pages/learner/CourseDetail";
import CourseMaterials
  from "../pages/learner/CourseMaterials";

import CourseAnnouncements
  from "../pages/learner/CourseAnnouncements";

import CourseAssessments
  from "../pages/learner/CourseAssessments";
import AssessmentReview
  from "../pages/learner/AssessmentReview";
import Progress from "../pages/learner/Progress";
import DeckManagement from "../pages/learner/DeckManagement";
import Flashcards from "../pages/learner/Flashcards";
import AIPracticeQuizzes from "../pages/learner/AIPracticeQuizzes";
import PracticeQuizViewer from "../pages/learner/PracticeQuizViewer";
import MyTicketsPage from "../pages/shared/MyTicketsPage";

/**
 * Component này điều hướng người dùng từ trang chủ ('/') đến dashboard
 * phù hợp với vai trò của họ. Nó hoạt động như trang đích sau khi đăng nhập.
 */
const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const normalizedRole =
    String(
      user.role || ''
    ).toLowerCase();


  switch (
    normalizedRole
  ) {
    case 'system_administrator':
      return (
        <Navigate
          to="/admin/dashboard"
          replace
        />
      );


    case 'educator':
      return (
        <Navigate
          to="/educator/dashboard"
          replace
        />
      );


    case 'learner':
      return (
        <Navigate
          to="/learner/dashboard"
          replace
        />
      );


    default:
      console.error(
        'Unknown user role:',
        user.role
      );

      return (
        <Navigate
          to="/auth/login"
          replace
        />
      );
  }
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRedirect />,
  },
  {
    path: "auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
    ],
  },

  // --- NHÓM ROUTE CHO LEARNER ---
  {
    path: "/learner",

    element: (
      <ProtectedRoute
        allowedRoles={[
          "LEARNER"
        ]}
      >
        <LearnerLayout />
      </ProtectedRoute>
    ),

    children: [
      {
        path: "dashboard",
        element: <Dashboard />
      },
      {
        path: "ai-workspace",
        element: <AIWorkspace />
      },
      {
        path: "my-courses",
        element: <MyCourses />
      },
      {
        path: "flashcards",
        element: <DeckManagement />
      },
      {
        path: "flashcards/study",
        element: <Flashcards />
      },
      {
        path: "quizzes",
        element: <Quiz />
      },
      {
        path: "assessments",
        element: <Assessments />
      },
      {
        path: "ai-quizzes",
        element: <AIPracticeQuizzes />
      },
      {
        path: "ai-quizzes/study",
        element: <PracticeQuizViewer />
      },
      {
        path: "notes",
        element: <Notes />
      },
      {
        path:
          "courses/:courseId",
        element:
          <CourseDetail />
      },

      {
        path:
          "courses/:courseId/materials",
        element:
          <CourseMaterials />
      },

      {
        path:
          "courses/:courseId/announcements",
        element:
          <CourseAnnouncements />
      },

      {
        path:
          "courses/:courseId/assessments",
        element:
          <CourseAssessments />
      },
      {
        path:
          "courses/:courseId/assessments/:assessmentId/assignment",
        element:
          <AssignmentSubmission />
      },
      {
        path:
          "courses/:courseId/assessments/:assessmentId/review",
        element:
          <AssessmentReview />
      },
      {
        path: "progress",
        element: <Progress />
      },
      {
        path: "community",
        element: <CommunityPage />
      },
      {
        path: "settings",
        element: <Settings />
      },
      { path: "support", 
        element: <MyTicketsPage /> 
      }
    ]
  },
  ...educatorRoutes,
  adminRoutes,
]);