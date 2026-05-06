import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import GamePage from "./pages/GamePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StatsPage from "./pages/StatsPage";
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
    return <p className="page">Laddar...</p>;
  }

  return (
    <div className="app-shell">
      <div className="match-background" aria-hidden="true">
        <div className="match-pitch">
          <span className="player player-home p1" />
          <span className="player player-home p2" />
          <span className="player player-home p3" />
          <span className="player player-home p4" />
          <span className="player player-home p5" />
          <span className="player player-home p6" />
          <span className="player player-away p7" />
          <span className="player player-away p8" />
          <span className="player player-away p9" />
          <span className="player player-away p10" />
          <span className="player player-away p11" />
          <span className="player player-away p12" />
          <span className="match-ball" />
        </div>
      </div>

      <nav className="topbar">
        <div className="nav-group">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true" />
            Swedle
          </Link>
          <div className="route-tabs" aria-label="Huvudnavigation">
            <NavLink className="nav-link" to="/">Spel</NavLink>
            <NavLink className="nav-link" to="/stats">Statistik</NavLink>
          </div>
        </div>

        <div className="auth-group">
          {user ? (
            <>
              {/* Logged-in users see their username and can end the session. */}
              <span className="user-chip">
                <span className="status-dot" aria-hidden="true" />
                Inloggad som <strong>{user.username}</strong>
              </span>
              <button className="button" onClick={logout}>Logga ut</button>
            </>
          ) : (
            <>
              {/* Logged-out users can navigate to authentication pages. */}
              <Link className="nav-link" to="/login">Logga in</Link>
              <Link className="button" to="/register">Registrera dig</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        {/* The main game is available at the root path. */}
        <Route path="/" element={<GamePage />} />

        {/* Logged-in users should not see login/register again, so redirect them home. */}
        <Route path="/" element={<GamePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
        
      </Routes>
    </div>
  );
}

export default App;
