import daisyui from "daisyui";
import typography from "@tailwindcss/typography";
import themes from "daisyui/src/theming/themes";
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  // `typography` supplies the `prose` classes the TipTap editor renders with.
  plugins: [typography, daisyui],
  daisyui: {
    // forest is the dark default; see src/libs/theme.js for how one is picked.
    // Stock daisyUI light fails WCAG AA for error, warning and the dimmed
    // `text-base-content/NN` tints on white, so those three are darkened here.
    themes: [
      "forest",
      {
        light: {
          ...themes.light,
          "base-content": "#0b1220",
          error: "#b42318",
          warning: "#8a5a00",
        },
      },
    ],
  },
};
