import { Outlet } from 'react-router';

import EducatorSidebar
  from '../components/layout/EducatorSidebar';

export default function EducatorLayout() {
  return (
    <div className="bg-gray-50 font-sans h-screen overflow-hidden text-gray-800">
      <div className="flex h-full w-full">
        <EducatorSidebar />

        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}