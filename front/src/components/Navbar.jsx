import { Link, useNavigate } from "react-router";
import { PlusIcon, LogOutIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/auth-context";

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
            <h1 className="text-3xl font-bold text-primary font-mono tracking-wide">
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
                  <Link to={"/create"} className="btn btn-primary">
                    <PlusIcon className="size-4" />
                    <span>new note</span>
                  </Link>
                  <button
                    className="btn btn-ghost"
                    onClick={handelLogout}
                    aria-label="Log out"
                  >
                    <LogOutIcon className="size-4" />
                    <span className="hidden sm:inline">logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to={"/login"} className="btn btn-ghost">
                    log in
                  </Link>
                  <Link to={"/signup"} className="btn btn-primary">
                    sign up
                  </Link>
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
