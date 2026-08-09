import { Outlet } from 'react-router';

export default function LearnerLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}