// Appearance preference. Stored per device in localStorage rather than on the
// account: it has to apply on /login before anyone is signed in, and a phone and
// a desktop reasonably differ. The inline script in index.html repeats the
// resolve step before first paint — keep the two in step.
const STORAGE_KEY = "vichar:theme";

// `system` is a preference, never a daisyUI theme: it resolves to one of the
// others from the OS setting. Forest is the dark theme and the fallback.
export const THEME_CHOICES = ["system", "forest", "light"];
const DARK_THEME = "forest";
const LIGHT_THEME = "light";

// Mirrors the `--b1` of each theme, for the browser chrome / status bar.
const CHROME_COLOR = { forest: "#171212", light: "#ffffff" };

const query = () => window.matchMedia("(prefers-color-scheme: light)");

export function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEME_CHOICES.includes(stored) ? stored : "system";
  } catch {
    // Storage denied (private window) — behave as if nothing was chosen.
    return "system";
  }
}

export function resolveTheme(preference) {
  if (preference === "system") {
    return query().matches ? LIGHT_THEME : DARK_THEME;
  }
  return preference;
}

export function applyTheme(preference) {
  const theme = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", CHROME_COLOR[theme]);
  return theme;
}

const listeners = new Set();
let preference = readPreference();

export function getPreference() {
  return preference;
}

export function setPreference(next) {
  if (!THEME_CHOICES.includes(next)) return;
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still applies for this session; it just will not persist.
  }
  applyTheme(next);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// `system` must follow the OS live, and another tab's choice should carry over.
export function initTheme() {
  applyTheme(preference);
  query().addEventListener("change", () => {
    if (preference === "system") {
      applyTheme("system");
      listeners.forEach((listener) => listener());
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    preference = readPreference();
    applyTheme(preference);
    listeners.forEach((listener) => listener());
  });
}
