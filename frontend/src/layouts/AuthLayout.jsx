import {
  Outlet,
  Navigate
} from 'react-router-dom';

import {
  useAuth
} from '../hooks/useAuth';


export default function AuthLayout() {
  const {
    user,
    loading
  } = useAuth();


  if (loading) {
    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
        "
      >
        Loading...
      </div>
    );
  }


  if (user) {
    const role =
      String(
        user.role || ''
      ).toLowerCase();


    if (
      role ===
      'learner'
    ) {
      return (
        <Navigate
          to="/learner/dashboard"
          replace
        />
      );
    }


    if (
      role ===
      'educator'
    ) {
      return (
        <Navigate
          to="/educator/dashboard"
          replace
        />
      );
    }


    if (
      role ===
      'system_administrator'
    ) {
      return (
        <Navigate
          to="/admin/dashboard"
          replace
        />
      );
    }


    console.error(
      'Unknown authenticated user role:',
      user.role
    );


    return (
      <Navigate
        to="/auth/login"
        replace
      />
    );
  }



  return (
    <div
      className="
        flex
        min-h-screen
        items-center
        justify-center
        p-4
        bg-gray-50
        font-sans
        text-gray-800
      "
    >
      <div
        className="
          w-full
          max-w-md
        "
      >
        <Outlet />
      </div>
    </div>
  );
}