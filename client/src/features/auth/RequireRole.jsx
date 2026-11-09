import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { STAFF_ROLES, selectAuthInitializing, selectUser } from './authSlice.js';

// area: 'customer' | 'staff'. Server still enforces RBAC; this only drives navigation.
export default function RequireRole({ area, children }) {
  const user = useSelector(selectUser);
  const initializing = useSelector(selectAuthInitializing);
  const location = useLocation();
  if (initializing) return <p className="center-note">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const isStaff = STAFF_ROLES.includes(user.role);
  if ((area === 'staff') !== isStaff) return <Navigate to={isStaff ? '/admin' : '/portal'} replace />;
  return children;
}

// Restrict a staff page to specific roles (the API enforces the same rule).
export function RequireAnyRole({ roles, children }) {
  const user = useSelector(selectUser);
  if (!roles.includes(user?.role)) return <Navigate to="/admin" replace />;
  return children;
}
