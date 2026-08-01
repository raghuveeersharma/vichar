import { Link, useNavigate } from "react-router";
import { PlusIcon, LogOutIcon, SettingsIcon, MenuIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/auth-context";
import Button from "./Button";

const Navbar = () => {
  const { user, checking, logout } = useAuth();
  const navigate = useNavigate();

  // daisyUI's dropdown opens on focus, so it stays open after a menu item is
  // clicked until something drops focus explicitly.
  const closeMenu = () => document.activeElement?.blur();

  const handelLogout = async () => {
    closeMenu();
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
                    size="xs"
                  >
                    new note
                  </Button>
                  {/* sm and up: settings and logout sit inline. Below that
                      they collapse into the hamburger menu next to it. */}
                  <Button
                    to="/settings"
                    variant="ghost"
                    icon={SettingsIcon}
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    settings
                  </Button>
                  <Button
                    variant="ghost"
                    icon={LogOutIcon}
                    onClick={handelLogout}
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    logout
                  </Button>

                  <div className="dropdown dropdown-end sm:hidden">
                    <div
                      tabIndex={0}
                      role="button"
                      className="btn btn-ghost btn-sm btn-square"
                      aria-label="Open menu"
                    >
                      <MenuIcon className="size-4" />
                    </div>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu z-10 mt-2 w-44 gap-1 rounded-box bg-base-200 p-2 shadow-lg"
                    >
                      <li className="menu-title px-3 py-1 text-xs">
                        {user.name}
                      </li>
                      <li>
                        <Link to="/settings" onClick={closeMenu}>
                          <SettingsIcon className="size-4" />
                          settings
                        </Link>
                      </li>
                      <li>
                        <button onClick={handelLogout} className="text-error">
                          <LogOutIcon className="size-4" />
                          logout
                        </button>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <Button to="/login" variant="ghost" size="sm">
                    log in
                  </Button>
                  <Button to="/signup" variant="primary" size="sm">
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
