import { useEffect, useState } from "react";
import api from "../libs/axios";
import { AuthContext } from "./auth-context";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // `checking` covers the initial /auth/me call. Routes must not decide whether
  // to redirect until it settles, otherwise a logged-in user is bounced to
  // /login on every refresh.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
      } catch {
        setUser(null); // no cookie, or it expired — stay logged out
      } finally {
        setChecking(false);
      }
    };
    restoreSession();
  }, []);

  // If the cookie expires mid-session the API starts answering 401. Dropping the
  // user here is enough to make ProtectedRoute redirect to /login, so individual
  // pages never have to handle that case.
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      (error) => {
        const isAuthCheck = error.config?.url?.includes("/auth/");
        if (error.response?.status === 401 && !isAuthCheck) {
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const signup = async (payload) => {
    const res = await api.post("/auth/signup", payload);
    setUser(res.data.user);
  };

  const login = async (payload) => {
    const res = await api.post("/auth/login", payload);
    setUser(res.data.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      // Clear locally even if the request fails, so the UI never strands the
      // user in a signed-in state they cannot leave.
      setUser(null);
    }
  };

  const updateEmail = async (payload) => {
    const res = await api.patch("/auth/email", payload);
    setUser(res.data.user);
  };

  // The server re-issues the cookie, so there is no session state to update here
  const updatePassword = async (payload) => {
    await api.patch("/auth/password", payload);
  };

  // Account preferences ride on the same `user` object every page already reads,
  // so flipping one re-renders whatever depends on it — CreatePage picks up the
  // encrypted-notes toggle with no fetch of its own.
  const updatePreferences = async (payload) => {
    const res = await api.patch("/auth/preferences", payload);
    setUser(res.data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        checking,
        signup,
        login,
        logout,
        updateEmail,
        updatePassword,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
