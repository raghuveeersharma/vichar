import { Route, Routes } from "react-router";
import Home from "./pages/Home";
import CreatePage from "./pages/CreatePage";
import NoteDetailPage from "./pages/NoteDetailPage";
import FolderPage from "./pages/FolderPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SettingsPage from "./pages/SettingsPage";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import AppBackground from "./components/AppBackground";
import SyncStatus from "./components/SyncStatus";
const App = () => {
  return (
    <div className="min-h-screen">
      <AppBackground />
      <Navbar />
      {/* Above the routes, not inside a page: a reconnect has to be noticed
          wherever the user is, and this is what sends the offline queue. In the
          normal flow — online, nothing queued — it renders nothing. */}
      <SyncStatus />
      <Routes>
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
    </div>
  );
};

export default App;
