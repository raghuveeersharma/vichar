import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeftIcon, KeyRoundIcon, LockIcon, MailIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";
import PasswordInput from "../components/PasswordInput";
import Button from "../components/Button";

// Both forms send the current password: the API re-verifies it before changing
// anything, so a stolen cookie alone cannot take over the account.
const SettingsPage = () => {
  const { user, updateEmail, updatePassword, updatePreferences } = useAuth();

  const [emailForm, setEmailForm] = useState({
    email: user?.email || "",
    currentPassword: "",
  });
  const [emailLoading, setEmailLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // The toggle renders straight off the session user rather than mirroring it
  // into local state: `updatePreferences` replaces that user, so the switch
  // follows the value the server actually stored instead of a copy that can
  // drift from it when a save fails.
  const encryptedNotesEnabled = Boolean(user?.encryptedNotesEnabled);
  const [preferenceLoading, setPreferenceLoading] = useState(false);

  const reportError = (error, fallback) => {
    console.error(fallback + ":", error);
    if (error.response?.status === 429) {
      toast.error("Too many attempts. Please try again later.");
    } else {
      toast.error(error.response?.data?.message || fallback);
    }
  };

  // No form and no submit button: a single switch that saves on change is the
  // whole interaction, and a "save" step next to it would only add a state the
  // user can leave unsaved.
  const handelEncryptedNotesToggle = async (e) => {
    const next = e.target.checked;
    try {
      setPreferenceLoading(true);
      await updatePreferences({ encryptedNotesEnabled: next });
      toast.success(
        next ? "Encrypted notes enabled" : "Encrypted notes disabled"
      );
    } catch (error) {
      reportError(error, "Failed to update setting");
    } finally {
      setPreferenceLoading(false);
    }
  };

  const handelEmailSubmit = async (e) => {
    e.preventDefault();
    const { email, currentPassword } = emailForm;
    if (!email.trim() || !currentPassword) {
      toast.error("All fields are required");
      return;
    }
    try {
      setEmailLoading(true);
      await updateEmail({ email: email.trim(), currentPassword });
      toast.success("Email updated");
      setEmailForm((prev) => ({ ...prev, currentPassword: "" }));
    } catch (error) {
      reportError(error, "Failed to update email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handelPasswordSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setPasswordLoading(true);
      await updatePassword({ currentPassword, newPassword });
      toast.success("Password updated");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      reportError(error, "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button to="/" variant="ghost" icon={ArrowLeftIcon} className="mb-6">
            Back to notes
          </Button>

          <h1 className="text-3xl font-bold mb-6">Settings</h1>

          {/* One panel holding both sections rather than two floating cards:
              stacked on a phone, separate glass slabs read as unrelated
              screens and eat vertical space to the gap between them. */}
          <div className="glass-panel-strong">
            <div className="card-body">
              <h2 className="card-title text-xl">
                <MailIcon className="size-5 text-primary" />
                Email address
              </h2>
              <p className="text-base-content/80 mb-2">
                You log in with this address.
              </p>
              <form onSubmit={handelEmailSubmit}>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">New email</span>
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="input input-bordered input-glass"
                    value={emailForm.email}
                    onChange={(e) =>
                      setEmailForm({ ...emailForm, email: e.target.value })
                    }
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </div>
                <PasswordInput
                  label="Current password"
                  className="mb-6"
                  placeholder="••••••••"
                  value={emailForm.currentPassword}
                  onChange={(e) =>
                    setEmailForm({
                      ...emailForm,
                      currentPassword: e.target.value,
                    })
                  }
                  autoComplete="current-password"
                  maxLength={72}
                  required
                />
                <div className="card-actions justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={emailLoading}
                  >
                    {emailLoading ? "Saving..." : "Update email"}
                  </Button>
                </div>
              </form>
            </div>

            <div className="mx-6 h-px bg-base-content/10" />

            <div className="card-body">
              <h2 className="card-title text-xl">
                <KeyRoundIcon className="size-5 text-primary" />
                Password
              </h2>
              <p className="text-base-content/80 mb-2">
                Use at least 6 characters.
              </p>
              <form onSubmit={handelPasswordSubmit}>
                <PasswordInput
                  label="Current password"
                  className="mb-4"
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  autoComplete="current-password"
                  maxLength={72}
                  required
                />
                <PasswordInput
                  label="New password"
                  className="mb-4"
                  placeholder="••••••••"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  autoComplete="new-password"
                  maxLength={72}
                  required
                />
                <PasswordInput
                  label="Confirm new password"
                  className="mb-6"
                  placeholder="••••••••"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  autoComplete="new-password"
                  maxLength={72}
                  required
                />
                <div className="card-actions justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={passwordLoading}
                  >
                    {passwordLoading ? "Saving..." : "Update password"}
                  </Button>
                </div>
              </form>
            </div>

            <div className="mx-6 h-px bg-base-content/10" />

            <div className="card-body">
              <h2 className="card-title text-xl">
                <LockIcon className="size-5 text-primary" />
                Encrypted notes
              </h2>
              <p className="text-base-content/80 mb-2">
                Adds a second button on the new-note page that seals the note
                before it is stored, so its text is unreadable in the database.
              </p>

              {/* `justify-start` so the label sits next to the switch instead of
                  being pushed to the far edge by daisyUI's default label layout,
                  which reads as two unrelated controls on a wide screen. */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={encryptedNotesEnabled}
                    onChange={handelEncryptedNotesToggle}
                    disabled={preferenceLoading}
                  />
                  <span className="label-text">
                    Allow me to create encrypted notes
                  </span>
                </label>
              </div>

              <p className="text-sm text-base-content/60">
                Turning this off only hides the button. Notes you already
                encrypted stay encrypted and keep opening normally.
              </p>
              <p className="text-sm text-warning">
                Encrypted notes can only be created and edited while online.
                Their decrypted contents are never stored for offline use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
