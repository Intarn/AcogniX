import {
  Navigate
} from 'react-router';

import CommunityPage from '../pages/shared/CommunityPage';

import ProtectedRoute
  from './ProtectedRoute';

import EducatorLayout
  from '../layouts/EducatorLayout';

import DashboardPage
  from '../pages/educator/DashboardPage';

import MyCoursesPage
  from '../pages/educator/MyCoursesPage';

import CourseBuilderPage
  from '../pages/educator/CourseBuilderPage';

import ClassDetailPage
  from '../pages/educator/ClassDetailPage';

import CourseMaterialsPage
  from '../pages/educator/CourseMaterialsPage';

import CourseMembersPage
  from '../pages/educator/CourseMembersPage';

import CourseAnnouncementsPage
  from '../pages/educator/CourseAnnouncementsPage';

import AssessmentsPage
  from '../pages/educator/AssessmentsPage';

import AssessmentBuilderPage
  from '../pages/educator/AssessmentBuilderPage';

import AssessmentDetailPage
  from '../pages/educator/AssessmentDetailPage';

import AssessmentSubmissionsPage
  from '../pages/educator/AssessmentSubmissionsPage';

import StudentsPage 
  from '../pages/educator/StudentsPage';

import GradebookPage
  from '../pages/educator/GradebookPage';

import StudentAnalyticsPage
  from '../pages/educator/StudentAnalyticsPage';

import Settings
  from '../pages/auth/Settings';  

export const educatorRoutes = [
  {
    path:
      '/educator',

    element: (
      <ProtectedRoute
        allowedRoles={[
          'EDUCATOR'
        ]}
      >
        <EducatorLayout />
      </ProtectedRoute>
    ),

    children: [
      {
        index: true,
        element: (
          <Navigate
            to="dashboard"
            replace
          />
        )
      },

      {
        path: 'dashboard',
        Component: DashboardPage
      },

      {
        path: 'courses',
        Component: MyCoursesPage
      },

      {
        path: 'courses/new',
        Component: CourseBuilderPage
      },

      {
        path: 'courses/:courseId/edit',
        Component: CourseBuilderPage
      },

      {
        path: 'courses/:courseId',
        Component: ClassDetailPage
      },
      {
        path:
            'courses/:courseId/materials',

        Component:
            CourseMaterialsPage
      },
      {
        path:
            'courses/:courseId/members',

        Component:
            CourseMembersPage
      },
      {
        path:
            'courses/:courseId/announcements',

        Component:
            CourseAnnouncementsPage
      },
      {
        path:
            'courses/:courseId/assessments',

        Component:
            AssessmentsPage
      },
      {
        path:
            'courses/:courseId/assessments/new',

        Component:
            AssessmentBuilderPage
      },
      {
        path:
            'courses/:courseId/assessments/:assessmentId',

        Component:
            AssessmentDetailPage
      },
      {
        path:
            'courses/:courseId/assessments/:assessmentId/edit',

        Component:
            AssessmentBuilderPage
      },
      {
        path:
            'courses/:courseId/assessments/:assessmentId/submissions',

        Component:
            AssessmentSubmissionsPage
      },
      {
        path: 'students',
        Component: StudentsPage
      }, 
      {
        path: 'gradebook',
        Component:
            GradebookPage
      },
      {
        path: 'analytics',
        Component:
            StudentAnalyticsPage
      },
      {
        path: 'settings',
        Component:
            Settings
      },
      {
        path: 'community',
        Component:
            CommunityPage
      }
    ]
  }
];