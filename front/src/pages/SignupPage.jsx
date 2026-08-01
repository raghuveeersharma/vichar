import { useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { UserPlusIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";
import PasswordInput from "../components/PasswordInput";
import Button from "../components/Button";

const SignupPage = () => {
  const [data, setData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handelSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password } = data;
    if (!name.trim() || !email.trim() || !password) {
      toast.error("All fields are required");
      return;
    }
    // Mirrors the server's minimum so the user is not sent on a round trip to
    // find out the password is too short.
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      setLoading(true);
      await signup({ name: name.trim(), email: email.trim(), password });
      toast.success("Account created");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error signing up:", error);
      if (error.response?.status === 429) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error(error.response?.data?.message || "Failed to sign up");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card bg-base-100 w-full max-w-md">
        <div className="card-body">
          <h1 className="card-title text-2xl mb-1">Create your account</h1>
          <p className="text-base-content/70 mb-4">
            Your notes stay private to you.
          </p>
          <form onSubmit={handelSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                placeholder="your name"
                className="input input-bordered"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                autoComplete="name"
                required
              />
            </div>
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
            <PasswordInput
              label="Password"
              className="mb-6"
              placeholder="at least 6 characters"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <Button
              type="submit"
              variant="primary"
              fullWidth
              icon={UserPlusIcon}
              loading={loading}
            >
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>
          <p className="text-sm text-base-content/70 mt-4 text-center">
            Already have an account?{" "}
            <Link to="/login" className="link link-primary">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
