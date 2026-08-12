import CommunityPage from '../pages/shared/CommunityPage';

export const sharedRoutes = {
  path: '/community',
  children: [
    { index: true, element: <CommunityPage /> },
    { path: 'community', element: <CommunityPage /> },
  ]
};