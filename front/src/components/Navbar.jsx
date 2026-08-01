import { Link, useNavigate } from "react-router";
import { PlusIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/auth-context";
import Button from "./Button";

const Navbar = () => {
  const { user, checking, logout } = useAuth();
  const navigate = useNavigate();

  const handelLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/login", { replace: true });
  };

  return (
    <header className="bg-base-300 border-b border-base-content/10">
      <div className="mx-auto max-w-6xl p-4 ">
        <div className="flex items-center justify-between">
          <Link to={"/"} className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary font-mono tracking-wide">
              Vichar
            </h1>
          </Link>
          {/* Render nothing while the session check is in flight, so the bar
              does not flash the wrong set of actions on load. */}
          {!checking && (
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <>
                  <span className="hidden sm:inline text-sm text-base-content/70">
                    {user.name}
                  </span>
                  <Button
                    to="/create"
                    variant="primary"
                    icon={PlusIcon}
                    aria-label="New note"
                  >
                    new note
                  </Button>
                  <Button
                    to="/settings"
                    variant="ghost"
                    icon={SettingsIcon}
                    hideLabelOnMobile
                    aria-label="Settings"
                  >
                    settings
                  </Button>
                  <Button
                    variant="ghost"
                    icon={LogOutIcon}
                    hideLabelOnMobile
                    onClick={handelLogout}
                    aria-label="Log out"
                  >
                    logout
                  </Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="ghost">
                    log in
                  </Button>
                  <Button to="/signup" variant="primary">
                    sign up
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
