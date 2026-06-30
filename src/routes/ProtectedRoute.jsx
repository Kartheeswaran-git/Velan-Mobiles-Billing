import { Navigate, useLocation } from "react-router-dom";
import Loader from "../components/Loader";
import { useAuth } from "../hooks/useAuth";
import { firstAllowedStaffPath, hasPermission } from "../utils/permissions";

export default function ProtectedRoute({ children, allowedRoles, permission, operation = "read" }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader text="Checking session..." />;
  }

  if (!user?.uid || user?.active === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin" : firstAllowedStaffPath(user)} replace />;
  }

  if (permission && !hasPermission(user, permission, operation)) {
    return <Navigate to={user.role === "admin" ? "/admin" : firstAllowedStaffPath(user)} replace />;
  }

  return children;
}
