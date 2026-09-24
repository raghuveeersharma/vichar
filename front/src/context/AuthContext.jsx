import { useCallback, useEffect, useState } from "react";
import api from "../libs/axios";
import { clearCache } from "../libs/cache";
import { AuthContext } from "./auth-context";

// The last known session user, mirrored into localStorage. This is the same
// `toPublicJSON` object every page already reads — no token, which stays in an
// httpOnly cookie JS cannot touch — so the mirror grants no access on its own:
// the cookie is still what authorises every request.
//
// It exists because the boot `GET /auth/me` is a network call, and without a
// network it fails. Treating that failure as "signed out" would send an offline
// user to /login, where signing in also needs the network — the app would be
// unreachable offline no matter how much was cached.
const SESSION_KEY = "vichar:session";

const readStoredSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Unparseable or storage denied — fall back to the network check.
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredSession);
  // `checking` covers the initial /auth/me call. Routes must not decide whether
  // to redirect until it settles, otherwise a logged-in user is bounced to
  // /login on every refresh.
  const [checking, setChecking] = useState(true);

  // One writer for the mirror, so every path that sets `user` — login, signup,
  // the 401 interceptor, logout — keeps it in step without remembering to.
  useEffect(() => {
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn("Could not persist the session:", error);
    }
  }, [user]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Offline with a stored session: there is nothing to verify against, and
        // the request would only fail. Trust the mirror and let the first real
        // API call sort it out — a dead cookie answers 401 and the interceptor
        // below signs the user out then.
        if (navigator.onLine === false && readStoredSession()) return;
        const res = await api.get("/auth/me");
        setUser(res.data.user);
      } catch (error) {
        // A response — 401 — is an answer: the cookie is gone, so drop the
        // session. A transport failure is not an answer, so the stored session
        // stands and the app opens offline.
        if (error.response) setUser(null);
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
      // Logout is the one signal that says "I am done with this device", so it is
      // where the offline copy of the notes goes. An expiring cookie deliberately
      // does not do this: cache entries are scoped to an owner id and only read
      // back for that same owner, so surviving a re-login means the user's own
      // notes are there instantly, and another account on the same browser still
      // cannot see them. Awaited, so a logout that is followed by closing the tab
      // does not leave the wipe half done.
      await clearCache();
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

  const resendEmailVerification = async () => {
    await api.post("/auth/email-verification/resend");
  };

  const verifyEmail = useCallback(async (token) => {
    const res = await api.post("/auth/verify-email", { token });
    // The token can be opened in another browser, but when it is opened in the
    // current session keep the local session mirror accurate immediately.
    setUser(res.data.user);
  }, []);

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
        resendEmailVerification,
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
