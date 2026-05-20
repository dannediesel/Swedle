import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Login page for existing users.
// It collects email/password, calls the shared auth context, and redirects after success.
export default function LoginPage() {
  // useNavigate lets us move the user to another route after login.
  const navigate = useNavigate();

  // login comes from AuthProvider and handles the API call + token storage.
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Error text shown when the backend rejects the login request.
  const [error, setError] = useState("");

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    // Prevent the browser from doing a full page reload when the form is submitted.
    event.preventDefault();

    try {
      setError("");
      await login(email, password);

      // After a successful login, return the user to the main game page.
      navigate("/");
    } catch {
      setError("Kunde inte logga in. Kontrollera din e-postadress och lösenord.");
    }
  }

  return (
    <div className="auth-card">
      <h1>Logga in</h1>
      <p className="hero-copy">Fortsätt jakten på dagens svenska landslagsspelare.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field-label">E-postadress</label>
        <input
          // Controlled input: React state is the source of truth for the email value.
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          className="input"
        />

        <label className="field-label">Lösenord</label>
        <input
          // Controlled input: React state is updated on every password change.
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className="input"
        />

        {error && <p className="error-message">{error}</p>}

        {/* Submitting the form triggers handleSubmit above. */}
        <button className="button" type="submit">Logga in</button>
      </form>

      <p className="auth-footer">
        Inget konto? <Link to="/register">Skapa här</Link>
      </p>
    </div>
  );
}
