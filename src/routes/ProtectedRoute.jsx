import { Navigate, useLocation } from "react-router-dom";
import Loader from "../components/Loader";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader text="Checking session..." />;
  }

  if (!user?.uid || user?.active === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
  }

  return children;
}
