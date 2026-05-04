import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import GamePage from "./pages/GamePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import "./App.css";

// Top-level React component for the frontend.
// It owns the main navigation and decides which page should be shown for each route.
function App() {
  // Auth state comes from AuthProvider in main.tsx.
  // user tells us whether someone is logged in, logout clears the session,
  // and isLoading is true while the app checks an existing saved token.
  const { user, logout, isLoading } = useAuth();

  // Avoid rendering routes before we know whether the user already has a valid token.
  if (isLoading) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  return (
    <div>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          borderBottom: "1px solid #333",
        }}
      >
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link to="/">Spel</Link>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {user ? (
            <>
              {/* Logged-in users see their username and can end the session. */}
              <span>Inloggad som {user.username}</span>
              <button onClick={logout}>Logga ut</button>
            </>
          ) : (
            <>
              {/* Logged-out users can navigate to authentication pages. */}
              <Link to="/login">Logga in</Link>
              <Link to="/register">Registrera dig</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        {/* The main game is available at the root path. */}
        <Route path="/" element={<GamePage />} />

        {/* Logged-in users should not see login/register again, so redirect them home. */}
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
      </Routes>
    </div>
  );
}

export default App;
