import { useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { MailIcon } from "lucide-react";
import api from "../libs/axios";
import Button from "../components/Button";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/password-reset/request", { email: email.trim() });
      setSubmitted(true);
    } catch (error) {
      console.error("Could not request password reset:", error);
      if (error.response?.status === 429) {
        toast.error("Too many requests. Please try again later.");
      } else {
        toast.error("Could not request a reset link. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center px-4 py-12">
      <div className="glass-panel-strong card w-full max-w-md">
        <div className="card-body">
          <MailIcon className="size-9 text-primary" aria-hidden="true" />
          <h1 className="card-title text-2xl mb-1">Reset your password</h1>
          {submitted ? (
            <>
              <p className="text-base-content/80">
                If that address belongs to a Vichar account, we sent a reset
                link. Check your inbox and spam folder.
              </p>
              <Link className="btn btn-primary mt-4" to="/login">
                Back to log in
              </Link>
            </>
          ) : (
            <>
              <p className="text-base-content/80 mb-4">
                Enter your email address and we&apos;ll send a one-use link that
                expires in one hour.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="form-control mb-6">
                  <label className="label" htmlFor="reset-email">
                    <span className="label-text">Email</span>
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    className="input input-bordered input-glass"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </div>
                <Button type="submit" variant="primary" fullWidth loading={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
