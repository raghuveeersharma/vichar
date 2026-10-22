import { useSyncExternalStore } from "react";
import {
  getPreference,
  resolveTheme,
  setPreference,
  subscribe,
} from "../libs/theme";

// `preference` is what the user picked (may be "system"); `theme` is what is
// actually applied right now.
export default function useTheme() {
  const preference = useSyncExternalStore(subscribe, getPreference);
  return { preference, theme: resolveTheme(preference), setTheme: setPreference };
}
