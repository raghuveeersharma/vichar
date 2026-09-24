import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";

const VerifyEmailPage = () => {
  const [state, setState] = useState("verifying");
  const { verifyEmail } = useAuth();

  useEffect(() => {
    const token = window.location.hash.slice(1);
    // Remove the credential from browser history as soon as it has been read.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setState("invalid");
      return;
    }

    verifyEmail(token)
      .then(() => setState("verified"))
      .catch(() => setState("invalid"));
  }, [verifyEmail]);

  const verified = state === "verified";
  const invalid = state === "invalid";
  return (
    <div className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center px-4 py-12">
      <div className="glass-panel-strong card w-full max-w-md text-center">
        <div className="card-body items-center">
          {state === "verifying" && <span className="loading loading-spinner loading-lg text-primary" />}
          {verified && <CheckCircle2Icon className="size-12 text-success" />}
          {invalid && <XCircleIcon className="size-12 text-error" />}
          <h1 className="card-title text-2xl">
            {state === "verifying" ? "Verifying email…" : verified ? "Email verified" : "This link is invalid"}
          </h1>
          <p className="text-base-content/80">
            {verified
              ? "Your email address has been verified."
              : invalid
                ? "This verification link has expired, was already used, or is incomplete. Request a new link from Settings after signing in."
                : "Please wait while we confirm your email address."}
          </p>
          {state !== "verifying" && (
            <Link className="btn btn-primary mt-3" to="/">
              Continue to Vichar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
