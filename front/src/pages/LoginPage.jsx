import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { LogInIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";
import PasswordInput from "../components/PasswordInput";
import Button from "../components/Button";

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
    /* Subtracting the navbar keeps the card optically centred in what is left
       of the viewport rather than pushed below the fold. The px-4 gutter is
       what stops the panel touching the edge on a phone. */
    <div className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center px-4 py-12">
      <div className="glass-panel-strong card w-full max-w-md">
        <div className="card-body">
          <h1 className="card-title text-2xl mb-1">Welcome back</h1>
          <p className="text-base-content/80 mb-4">
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
                className="input input-bordered input-glass"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                autoComplete="email"
                maxLength={254}
                required
              />
            </div>
            <PasswordInput
              label="Password"
              className="mb-6"
              placeholder="••••••••"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              autoComplete="current-password"
              maxLength={72}
              required
            />
            <Button
              type="submit"
              variant="primary"
              fullWidth
              icon={LogInIcon}
              loading={loading}
            >
              {loading ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="text-sm text-base-content/80 mt-4 text-center">
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
