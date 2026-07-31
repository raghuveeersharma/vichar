import { Navigate, Outlet, useLocation } from "react-router";
import { LoaderIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";

// Wraps the note routes. Waits for the session check before deciding, and
// remembers where the user was headed so login can send them back there.
const ProtectedRoute = () => {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10 text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
