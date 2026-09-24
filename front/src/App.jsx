import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import AppBackground from "./components/AppBackground";
import SyncStatus from "./components/SyncStatus";

// Pages are separate navigation destinations, so defer their code until the
// matching route is needed. In particular, the editor and its TipTap extensions
// no longer add their weight to the login and initial notes-list download.
const Home = lazy(() => import("./pages/Home"));
const CreatePage = lazy(() => import("./pages/CreatePage"));
const NoteDetailPage = lazy(() => import("./pages/NoteDetailPage"));
const FolderPage = lazy(() => import("./pages/FolderPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

const RouteLoading = () => (
  <div
    className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center"
    role="status"
    aria-label="Loading page"
  >
    <span className="loading loading-spinner loading-lg text-primary" />
  </div>
);

const App = () => {
  return (
    <div className="min-h-screen">
      <AppBackground />
      <Navbar />
      {/* Above the routes, not inside a page: a reconnect has to be noticed
          wherever the user is, and this is what sends the offline queue. In the
          normal flow — online, nothing queued — it renders nothing. */}
      <SyncStatus />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* The token stays in the URL fragment until this page POSTs it; the
              endpoint itself deliberately works without an existing session. */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          {/* Signed out only */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          {/* Signed in only — the API rejects these requests without a session anyway */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/note/:id" element={<NoteDetailPage />} />
            {/* `:folderId` is a folder id, or the literal "unfiled" for the notes
                that belong to no folder — the API accepts the same two values. */}
            <Route path="/folder/:folderId" element={<FolderPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
};

export default App;
