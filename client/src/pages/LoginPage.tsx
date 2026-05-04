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

  // Pre-filled values make local testing quicker while the app is still in development.
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");

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
    <div style={{ maxWidth: "420px", margin: "4rem auto", padding: "2rem" }}>
      <h1>Logga in</h1>

      <form onSubmit={handleSubmit}>
        <label>E-postadress</label>
        <input
          // Controlled input: React state is the source of truth for the email value.
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          style={{ display: "block", width: "100%", padding: "0.75rem", marginBottom: "1rem" }}
        />

        <label>Lösenord</label>
        <input
          // Controlled input: React state is updated on every password change.
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          style={{ display: "block", width: "100%", padding: "0.75rem", marginBottom: "1rem" }}
        />

        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

        {/* Submitting the form triggers handleSubmit above. */}
        <button type="submit">Logga in</button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Inget konto? <Link to="/register">Skapa här</Link>
      </p>
    </div>
  );
}
