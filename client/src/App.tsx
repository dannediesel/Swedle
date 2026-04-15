import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:3000/")
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setError("Could not connect to backend");
      });
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Swedle</h1>
      <p>Frontend is running.</p>
      <p>Backend message: {message}</p>
      {error && <p>{error}</p>}
    </div>
  );
}

export default App;