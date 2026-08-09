import { Outlet } from 'react-router';

export default function EducatorLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}