import { MoonIcon, SunIcon } from "lucide-react";
import useTheme from "../hooks/useTheme";

// Quick flip between the two looks. It sets an explicit choice, so it leaves
// "system" — the full three-way picker lives on the settings page.
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "forest" : "light";
  const Icon = theme === "light" ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="btn btn-ghost btn-sm btn-square max-md:min-h-[44px] max-md:min-w-[44px]"
      aria-label={`Switch to ${next === "light" ? "light" : "dark"} theme`}
      title={`Switch to ${next === "light" ? "light" : "dark"} theme`}
    >
      <Icon className="size-4" />
    </button>
  );
};

export default ThemeToggle;
