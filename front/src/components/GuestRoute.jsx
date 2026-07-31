import { Navigate, Outlet } from "react-router";
import { LoaderIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";

// Inverse of ProtectedRoute: keeps a signed-in user off /login and /signup.
const GuestRoute = () => {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10 text-primary" />
      </div>
    );
  }

  return user ? <Navigate to="/" replace /> : <Outlet />;
};

export default GuestRoute;
