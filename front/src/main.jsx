import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
      {/* All of the pill styling lives in `.glass-toast` (index.css) rather
          than in a `style` object here — inline styles would win over the
          reduced-transparency fallback. */}
      <Toaster toastOptions={{ className: "glass-toast" }} />
    </BrowserRouter>
  </StrictMode>
);
