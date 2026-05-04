import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/authContext";
import "./index.css";
import App from "./App.tsx";

// main.tsx is the frontend entry point.
// It finds the root DOM element from index.html and mounts the React app into it.
createRoot(document.getElementById("root")!).render(
  // StrictMode helps catch React issues during development.
  <StrictMode>
    {/* BrowserRouter enables client-side routes like /login and /register. */}
    <BrowserRouter>
      {/* AuthProvider makes login state available to the whole app. */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
