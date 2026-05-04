import { useEffect, useRef, useState } from "react";
import "./App.css";

// Same player shape that the backend returns from /api/players and /api/players/search.
type Player = {
  id: number;
  fullName: string;
  birthYear: number | null;
  primaryPosition: string;
  dominantFoot: string;
  swedenPrimaryShirtNumber: number | null;
  swedenAllShirtNumbers: number[];
  clubsClueList: string[];
  nationalTeamCaps: number;
  nationalTeamGoals: number;
  ntStartYear: number;
  ntEndYear: number;
};

// Feedback statuses from the backend.
// The frontend uses these values to decide colors and higher/lower arrows.
type ComparisonStatus = "correct" | "incorrect" | "higher" | "lower" | "partial";

// Response shape returned after submitting a guess to /api/game/guess.
type GuessResult = {
  guessedPlayer: Player;
  isCorrect: boolean;
  comparisons: {
    fullName: ComparisonStatus;
    primaryPosition: ComparisonStatus;
    dominantFoot: ComparisonStatus;
    swedenPrimaryShirtNumber: ComparisonStatus;
    clubs: ComparisonStatus;
    birthYear: ComparisonStatus;
    nationalTeamCaps: ComparisonStatus;
    nationalTeamGoals: ComparisonStatus;
  };
};

// General color mapping for comparison cells in the guess table.
function getStatusStyle(status: ComparisonStatus) {
  switch (status) {
    case "correct":
      return { backgroundColor: "#2e7d32", color: "white" };
    case "incorrect":
      return { backgroundColor: "#c62828", color: "white" };
    case "higher":
    case "lower":
    case "partial":
      return { backgroundColor: "#f9a825", color: "black" };
    default:
      return { backgroundColor: "#333", color: "white" };
  }
}

// Club comparison has a special "partial" state when players share at least one club.
function getClubStatusStyle(status: ComparisonStatus) {
  if (status === "correct") {
    return { backgroundColor: "#2e7d32", color: "white" };
  }

  if (status === "partial") {
    return { backgroundColor: "#f59e0b", color: "black" };
  }

  return { backgroundColor: "#c62828", color: "white" };
}

// Some columns should only show green for exact matches and red otherwise.
function getStrictStatusStyle(status: ComparisonStatus) {
  if (status === "correct") {
    return { backgroundColor: "#2e7d32", color: "white" };
  }

  return { backgroundColor: "#c62828", color: "white" };
}

// Adds arrows to numeric clues when the target value is higher or lower than the guess.
function formatNumberWithHint(value: number | null, status: ComparisonStatus) {
  if (value === null) return "Unknown";
  if (status === "higher") return `${value} ↑`;
  if (status === "lower") return `${value} ↓`;
  return value;
}

function App() {
  // Text currently typed into the autocomplete input.
  const [query, setQuery] = useState("");

  // Search suggestions returned from the backend.
  const [results, setResults] = useState<Player[]>([]);

  // Submitted guesses, newest first, shown in the feedback table.
  const [guesses, setGuesses] = useState<GuessResult[]>([]);

  // Simple user-facing error message for failed API calls.
  const [error, setError] = useState("");

  // Which autocomplete suggestion is highlighted for keyboard navigation.
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Refs to suggestion elements, used to keep the selected suggestion visible while arrowing.
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    // Debounce search so the app does not call the backend on every single keystroke.
    const timeoutId = setTimeout(() => {
      fetch(`http://localhost:3000/api/players/search?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => {
          // Select the first result by default so Enter can submit it immediately.
          setResults(data);
          setSelectedIndex(data.length > 0 ? 0 : -1);
        })
        .catch(() => {
          setError("Could not fetch player search results");
        });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    // When navigating with arrow keys, scroll the active result into view.
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  async function handleGuess(player: Player) {
    try {
      setError("");

      // Send only the player id; the backend owns the target-player logic and feedback rules.
      const response = await fetch("http://localhost:3000/api/game/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: player.id }),
      });

      const data: GuessResult = await response.json();

      // Add the new guess at the top and reset the autocomplete state.
      setGuesses((previous) => [data, ...previous]);
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    } catch {
      setError("Could not submit guess");
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;

    // Move the highlighted suggestion down without moving the text cursor.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => {
        if (prev < results.length - 1) return prev + 1;
        return prev;
      });
      return;
    }

    // Move the highlighted suggestion up without moving the text cursor.
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => {
        if (prev > 0) return prev - 1;
        return 0;
      });
      return;
    }

    // Enter submits the highlighted suggestion, or an exact name match as fallback.
    if (event.key === "Enter") {
      event.preventDefault();

      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleGuess(results[selectedIndex]);
        return;
      }

      const exactMatch = results.find(
        (player) => player.fullName.toLowerCase() === query.trim().toLowerCase()
      );

      if (exactMatch) {
        handleGuess(exactMatch);
      }
      return;
    }

    // Escape closes the suggestion list.
    if (event.key === "Escape") {
      setResults([]);
      setSelectedIndex(-1);
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ marginBottom: "0.5rem" }}>Swedle</h1>
        <p style={{ marginBottom: "2rem" }}>
          Gissa den gömda svenska landslagsspelaren!
        </p>

        <div style={{ width: "100%", maxWidth: "500px", position: "relative" }}>
          <label
            htmlFor="player-search"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              textAlign: "left",
            }}
          >
            Sök spelare
          </label>

          <input
            id="player-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Skriv spelarens namn..."
            autoComplete="off"
            style={{
              display: "block",
              width: "100%",
              padding: "0.9rem 1rem",
              fontSize: "1rem",
              borderRadius: "8px",
            }}
          />

          {results.length > 0 && (
            <ul
              style={{
                marginTop: "0.5rem",
                padding: 0,
                listStyle: "none",
                border: "1px solid #444",
                borderRadius: "8px",
                overflowY: "auto",
                maxHeight: "260px",
                backgroundColor: "#111",
              }}
            >
              {results.map((player, index) => (
                <li
                  key={player.id}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  onClick={() => handleGuess(player)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderBottom: "1px solid #333",
                    cursor: "pointer",
                    backgroundColor: selectedIndex === index ? "#1f2937" : "transparent",
                  }}
                >
                  <strong>{player.fullName}</strong>
                  <div>
                    {player.primaryPosition} • {player.birthYear ?? "Unknown"} •{" "}
                    {player.nationalTeamCaps} caps
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* API errors are shown near the search area so the user sees what failed. */}
      {error && <p style={{ marginTop: "1rem", color: "#ff6b6b" }}>{error}</p>}

      {/* The table appears only after the first guess has been submitted. */}
      {guesses.length > 0 && (
        <div style={{ marginTop: "2rem", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1000px",
            }}
          >
            <thead>
              <tr>
                <th>Spelare</th>
                <th>Position</th>
                <th>Fot</th>
                <th>Tröjnummer</th>
                <th>Klubbar</th>
                <th>Födelseår</th>
                <th>Landskamper</th>
                <th>Mål</th>
              </tr>
            </thead>
            <tbody>
              {guesses.map((guess, index) => (
                <tr key={`${guess.guessedPlayer.id}-${index}`}>
                  <td style={{ ...getStatusStyle(guess.comparisons.fullName), padding: "0.75rem" }}>
                    {guess.guessedPlayer.fullName}
                  </td>
                  <td
                    style={{
                      ...getStatusStyle(guess.comparisons.primaryPosition),
                      padding: "0.75rem",
                    }}
                  >
                    {guess.guessedPlayer.primaryPosition}
                  </td>
                  <td
                    style={{
                      ...getStatusStyle(guess.comparisons.dominantFoot),
                      padding: "0.75rem",
                    }}
                  >
                    {guess.guessedPlayer.dominantFoot}
                  </td>
                  <td
                    style={{
                      ...getStrictStatusStyle(guess.comparisons.swedenPrimaryShirtNumber),
                      padding: "0.75rem",
                    }}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.swedenPrimaryShirtNumber,
                      guess.comparisons.swedenPrimaryShirtNumber
                    )}
                  </td>
                  <td
                    style={{
                      ...getClubStatusStyle(guess.comparisons.clubs),
                      padding: "0.75rem",
                    }}
                  >
                    {guess.guessedPlayer.clubsClueList.join(", ")}
                  </td>
                  <td
                    style={{
                      ...getStrictStatusStyle(guess.comparisons.birthYear),
                      padding: "0.75rem",
                    }}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.birthYear,
                      guess.comparisons.birthYear
                    )}
                  </td>
                  <td
                    style={{
                      ...getStrictStatusStyle(guess.comparisons.nationalTeamCaps),
                      padding: "0.75rem",
                    }}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.nationalTeamCaps,
                      guess.comparisons.nationalTeamCaps
                    )}
                  </td>
                  <td
                    style={{
                      ...getStrictStatusStyle(guess.comparisons.nationalTeamGoals),
                      padding: "0.75rem",
                    }}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.nationalTeamGoals,
                      guess.comparisons.nationalTeamGoals
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
