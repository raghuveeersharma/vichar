import { useEffect, useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { KeyRoundIcon } from "lucide-react";
import api from "../libs/axios";
import PasswordInput from "../components/PasswordInput";
import Button from "../components/Button";

const ResetPasswordPage = () => {
  const [token, setToken] = useState("");
  const [passwords, setPasswords] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    // The server never receives URL fragments; remove the credential from
    // history as soon as it is read so it cannot be reused by the back button.
    window.history.replaceState(null, "", window.location.pathname);
    setToken(fragment);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (passwords.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (passwords.password !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/password-reset/confirm", {
        token,
        newPassword: passwords.password,
      });
      setComplete(true);
    } catch (error) {
      console.error("Could not reset password:", error);
      if (error.response?.status === 429) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error(error.response?.data?.message || "Could not reset password");
      }
    } finally {
      setLoading(false);
    }
  };

  const invalidLink = !token && !complete;
  return (
    <div className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center px-4 py-12">
      <div className="glass-panel-strong card w-full max-w-md">
        <div className="card-body">
          <KeyRoundIcon className="size-9 text-primary" aria-hidden="true" />
          <h1 className="card-title text-2xl mb-1">
            {complete ? "Password reset" : invalidLink ? "This link is invalid" : "Choose a new password"}
          </h1>
          {complete ? (
            <>
              <p className="text-base-content/80">
                Your password has been changed. For security, sign in again on
                all devices.
              </p>
              <Link className="btn btn-primary mt-4" to="/login">
                Log in
              </Link>
            </>
          ) : invalidLink ? (
            <>
              <p className="text-base-content/80">
                This reset link is incomplete. Request a new one to continue.
              </p>
              <Link className="btn btn-primary mt-4" to="/forgot-password">
                Request a reset link
              </Link>
            </>
          ) : (
            <>
              <p className="text-base-content/80 mb-4">
                Use at least 6 characters. This will sign out any existing
                sessions.
              </p>
              <form onSubmit={handleSubmit}>
                <PasswordInput
                  label="New password"
                  className="mb-4"
                  value={passwords.password}
                  onChange={(event) => setPasswords({ ...passwords, password: event.target.value })}
                  autoComplete="new-password"
                  maxLength={72}
                  required
                />
                <PasswordInput
                  label="Confirm new password"
                  className="mb-6"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                  autoComplete="new-password"
                  maxLength={72}
                  required
                />
                <Button type="submit" variant="primary" fullWidth loading={loading}>
                  {loading ? "Resetting…" : "Reset password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
