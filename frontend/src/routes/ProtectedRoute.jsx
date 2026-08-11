import {
  Navigate,
  Outlet
} from 'react-router';

import {
  useAuth
} from '../hooks/useAuth';

export default function ProtectedRoute({
  allowedRoles
}) {
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

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return <Outlet />;
}