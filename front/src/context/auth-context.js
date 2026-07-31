import { createContext, useContext } from "react";

// Kept out of AuthContext.jsx so that file only exports a component, which is
// what Vite's fast-refresh rule requires.
export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
};
