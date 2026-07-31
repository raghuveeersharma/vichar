import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { LogInIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";

const LoginPage = () => {
  const [data, setData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by ProtectedRoute when it bounced an unauthenticated visit
  const redirectTo = location.state?.from || "/";

  const handelSubmit = async (e) => {
    e.preventDefault();
    const { email, password } = data;
    if (!email.trim() || !password) {
      toast.error("All fields are required");
      return;
    }
    try {
      setLoading(true);
      await login({ email: email.trim(), password });
      toast.success("Welcome back");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      console.error("Error logging in:", error);
      if (error.response?.status === 429) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error(error.response?.data?.message || "Failed to log in");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card bg-base-100 w-full max-w-md">
        <div className="card-body">
          <h1 className="card-title text-2xl mb-1">Welcome back</h1>
          <p className="text-base-content/70 mb-4">
            Log in to see your notes.
          </p>
          <form onSubmit={handelSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="input input-bordered"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                autoComplete="email"
                required
              />
            </div>
            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered"
                value={data.password}
                onChange={(e) => setData({ ...data, password: e.target.value })}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                "Logging in..."
              ) : (
                <>
                  <LogInIcon className="size-4" />
                  Log in
                </>
              )}
            </button>
          </form>
          <p className="text-sm text-base-content/70 mt-4 text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="link link-primary">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
