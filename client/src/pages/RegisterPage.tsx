import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/authApi";

// Register page for new users.
// It creates an account through the backend and then sends the user to the login page.
export default function RegisterPage() {
  // Used to redirect after successful registration.
  const navigate = useNavigate();

  // Controlled form fields for the registration request.
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // User-facing error message if registration fails.
  const [error, setError] = useState("");

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    // Prevent a full browser reload when the form is submitted.
    event.preventDefault();

    try {
      setError("");

      // Create the user in the backend database.
      await registerUser(username, email, password);

      // Registration does not log in automatically, so move the user to /login.
      navigate("/login");
    } catch {
      setError("Kunde inte skapa konto. Försök med ett annat användarnamn eller e-postadress.");
    }
  }

  return (
    <div style={{ maxWidth: "420px", margin: "4rem auto", padding: "2rem" }}>
      <h1>Skapa konto</h1>

      <form onSubmit={handleSubmit}>
        <label>Användarnamn</label>
        <input
          // Controlled input: React state stores the current username value.
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          style={{ display: "block", width: "100%", padding: "0.75rem", marginBottom: "1rem" }}
        />

        <label>E-postadress</label>
        <input
          // Controlled input: updates email state as the user types.
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          style={{ display: "block", width: "100%", padding: "0.75rem", marginBottom: "1rem" }}
        />

        <label>Lösenord</label>
        <input
          // Controlled input: updates password state as the user types.
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          style={{ display: "block", width: "100%", padding: "0.75rem", marginBottom: "1rem" }}
        />

        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

        {/* Submitting the form triggers handleSubmit above. */}
        <button type="submit">Skapa konto</button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Har du redan ett konto? <Link to="/login">Logga in</Link>
      </p>
    </div>
  );
}
