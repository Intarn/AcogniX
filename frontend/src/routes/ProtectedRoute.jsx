import {
  Navigate,
  Outlet
} from 'react-router';

import {
  useAuth
} from '../hooks/useAuth';


export default function ProtectedRoute({
  allowedRoles,
  children
}) {
  const {
    user,
    loading
  } = useAuth();


  /*
   * Authentication state
   * is still being restored.
   */
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


  /*
   * Not logged in.
   */
  if (!user) {
    return (
      <Navigate
        to="/auth/login"
        replace
      />
    );
  }


  const userRole =
    String(
      user.role ||
      ''
    ).toUpperCase();


  const normalizedAllowedRoles =
    Array.isArray(
      allowedRoles
    )
      ? allowedRoles.map(
          (role) =>
            String(
              role
            ).toUpperCase()
        )
      : null;


  /*
   * Logged in, but wrong role.
   */
  if (
    normalizedAllowedRoles &&
    !normalizedAllowedRoles.includes(
      userRole
    )
  ) {
    if (
      userRole ===
      'LEARNER'
    ) {
      return (
        <Navigate
          to="/learner/dashboard"
          replace
        />
      );
    }


    if (
      userRole ===
      'EDUCATOR'
    ) {
      return (
        <Navigate
          to="/educator/dashboard"
          replace
        />
      );
    }


    if (
      userRole ===
      'SYSTEM_ADMINISTRATOR'
    ) {
      return (
        <Navigate
          to="/admin/dashboard"
          replace
        />
      );
    }


    // Role không hợp lệ / không xác định
    return (
      <Navigate
        to="/auth/login"
        replace
      />
    );
  }

  return (
    children ||
    <Outlet />
  );
}