import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/useAuth";
import "./../App.css";

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

// The game page can show daily, friend challenge, or practice sessions.
type GameMode = "DAILY" | "FRIEND_CHALLENGE" | "PRACTICE";

// Response shape for one submitted guess.
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

type GameHint = {
  id: string;
  order: number;
  type: string;
  text: string;
};

// Backend state for one game session, daily or practice.
type GameState = {
  sessionId: string;
  mode: "DAILY" | "FRIEND_CHALLENGE" | "PRACTICE";
  status: "IN_PROGRESS" | "SOLVED" | "FAILED";
  attempts: number;
  guesses: GuessResult[];
  hints: GameHint[];
  availableHints: number;
};

// General color mapping for comparison cells in the guess table.
function getStatusStyle(status: ComparisonStatus) {
  switch (status) {
    case "correct":
      return {
        background:
          "linear-gradient(135deg, rgba(18, 135, 83, 0.96) 0%, rgba(10, 93, 64, 0.96) 100%)",
        borderColor: "rgba(190, 255, 213, 0.18)",
        color: "#effff5",
      };
    case "incorrect":
      return {
        background:
          "linear-gradient(135deg, rgba(179, 54, 45, 0.96) 0%, rgba(125, 37, 45, 0.96) 100%)",
        borderColor: "rgba(255, 184, 168, 0.16)",
        color: "#fff6f3",
      };
    case "higher":
    case "lower":
    case "partial":
      return {
        background:
          "linear-gradient(135deg, rgba(255, 193, 51, 0.98) 0%, rgba(214, 126, 31, 0.98) 100%)",
        borderColor: "rgba(255, 232, 156, 0.24)",
        color: "#18233a",
      };
    default:
      return {
        background:
          "linear-gradient(135deg, rgba(15, 45, 82, 0.96) 0%, rgba(7, 27, 53, 0.96) 100%)",
        borderColor: "rgba(160, 196, 235, 0.14)",
        color: "#f8fafc",
      };
  }
}

// Some columns should only show green for exact matches and red otherwise.
function getStrictStatusStyle(status: ComparisonStatus) {
  if (status === "correct") {
    return getStatusStyle("correct");
  }

  return getStatusStyle("incorrect");
}

// Adds arrows to numeric clues when the target value is higher or lower than the guess.
function formatNumberWithHint(value: number | null, status: ComparisonStatus) {
  if (value === null) return "Unknown";
  if (status === "higher") return `${value} ↑`;
  if (status === "lower") return `${value} ↓`;
  return value;
}

export default function GamePage() {
  const { user } = useAuth();
  const { sessionId: challengeSessionId } = useParams();

  // Which game mode the page is currently showing.
  const [activeMode, setActiveMode] = useState<GameMode>("DAILY");

  // Text currently typed into the autocomplete input.
  const [query, setQuery] = useState("");

  // Search suggestions returned from the backend.
  const [results, setResults] = useState<Player[]>([]);

  // Submitted guesses, newest first, shown in the feedback table.
  const [guesses, setGuesses] = useState<GuessResult[]>([]);

  // Current status of the active game session.
  const [gameStatus, setGameStatus] = useState<GameState["status"]>("IN_PROGRESS");

  // Current session id, used by shared session actions such as requesting hints.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Practice games need a session id so guesses go to the right backend session.
  const [practiceSessionId, setPracticeSessionId] = useState<string | null>(null);

  // Hints are generated and persisted by the backend.
  const [hints, setHints] = useState<GameHint[]>([]);
  const [availableHints, setAvailableHints] = useState(0);

  // Simple user-facing error message for failed API calls.
  const [error, setError] = useState("");

  // Which autocomplete suggestion is highlighted for keyboard navigation.
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Refs to suggestion elements, used to keep the selected suggestion visible while arrowing.
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const trimmedQuery = query.trim();

  // Do not show old suggestions or guesses when the user is logged out.
  const visibleResults = user && trimmedQuery ? results : [];
  const visibleGuesses = user ? guesses : [];
  const visibleHints = user ? hints : [];

  // The backend returns guesses oldest first, while the UI shows newest first.
  const applyGameState = useCallback((data: GameState) => {
    setGuesses([...data.guesses].reverse());
    setGameStatus(data.status);
    setCurrentSessionId(data.sessionId);
    setHints(data.hints);
    setAvailableHints(data.availableHints);

    if (data.mode === "PRACTICE") {
      setPracticeSessionId(data.sessionId);
    }
  }, []);

  // Load the user's current daily game state, including previous guesses.
  const loadDailyGame = useCallback(async () => {
    try {
      const data = await apiRequest<GameState>("/api/game/daily");

      setError("");
      setActiveMode("DAILY");
      setPracticeSessionId(null);
      applyGameState(data);
    } catch {
      setError("Kunde inte ladda dagens utmaning.");
    }
  }, [applyGameState]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (challengeSessionId) {
      apiRequest<GameState>(`/api/game/friend-challenges/${challengeSessionId}`)
        .then((data) => {
          setError("");
          setActiveMode("FRIEND_CHALLENGE");
          setPracticeSessionId(null);
          applyGameState(data);
        })
        .catch(() => {
          setError("Kunde inte ladda vänutmaningen.");
        });
      return;
    }

    let isCurrentRequest = true;

    // Logged-in users start on their saved daily challenge.
    apiRequest<GameState>("/api/game/daily")
      .then((data) => {
        // Ignore late responses if the user changed while the request was still running.
        if (!isCurrentRequest) {
          return;
        }

        setError("");
        setActiveMode("DAILY");
        setPracticeSessionId(null);
        applyGameState(data);
      })
      .catch(() => {
        // Ignore errors from an old request after the effect has cleaned up.
        if (!isCurrentRequest) {
          return;
        }

        setError("Kunde inte ladda dagens utmaning.");
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [user, applyGameState, challengeSessionId]);

  useEffect(() => {
    if (!user || !trimmedQuery) {
      return;
    }

    // Debounce search so the app does not call the backend on every single keystroke.
    const timeoutId = setTimeout(() => {
      fetch(`http://localhost:3000/api/players/search?q=${encodeURIComponent(trimmedQuery)}`)
        .then((response) => response.json())
        .then((data) => {
          // Select the first result by default so Enter can submit it immediately.
          setResults(data);
          setSelectedIndex(data.length > 0 ? 0 : -1);
        })
        .catch(() => {
          setError("Kunde inte hämta spelarsökningen.");
        });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [user, trimmedQuery]);

  useEffect(() => {
    // When navigating with arrow keys, scroll the active result into view.
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  // Create a fresh practice game with a random target player.
  async function startNewPracticeGame() {
    if (!user) {
      setError("Du behöver logga in innan du kan starta träningsläge.");
      return;
    }

    try {
      setError("");
      setActiveMode("PRACTICE");

      // Practice sessions are created on demand and return their own session id.
      const data = await apiRequest<GameState>("/api/game/practice/new", {
        method: "POST",
      });

      applyGameState(data);
    } catch {
      setError("Kunde inte starta slumpmässigt spel.");
    }
  }

  // Submit one guess to whichever mode is currently active.
  async function handleGuess(player: Player) {
    if (!user) {
      setError("Du behöver logga in innan du kan gissa.");
      return;
    }

    if (gameStatus !== "IN_PROGRESS") {
      setError(
        gameStatus === "FAILED"
          ? "Den här omgången är redan förlorad."
          : "Det här spelet är redan löst."
      );
      return;
    }

    try {
      setError("");

      // Daily guesses use the daily route; practice guesses target the current practice session.
      const endpoint =
        activeMode === "DAILY"
          ? "/api/game/daily/guess"
          : activeMode === "FRIEND_CHALLENGE"
            ? `/api/game/friend-challenges/${currentSessionId}/guess`
          : `/api/game/practice/${practiceSessionId}/guess`;

      const data = await apiRequest<GameState>(endpoint, {
        method: "POST",
        body: JSON.stringify({ playerId: player.id }),
      });

      // The backend returns the full updated game state after the guess.
      applyGameState(data);
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    } catch {
      setError("Kunde inte skicka gissningen. Spelaren kan redan ha gissats.");
    }
  }

  async function handleRequestHint() {
    if (!user || !currentSessionId) {
      setError("Du måste vara inne i en spelomgång för att använda ledtråd.");
      return;
    }

    try {
      setError("");

      const data = await apiRequest<GameState>(
        `/api/game/sessions/${currentSessionId}/hint`,
        { method: "POST" }
      );

      applyGameState(data);
    } catch {
      setError("Ingen ledtråd är tillgänglig ännu.");
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (visibleResults.length === 0) return;

    // Move the highlighted suggestion down without moving the text cursor.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => {
        if (prev < visibleResults.length - 1) return prev + 1;
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

      if (selectedIndex >= 0 && visibleResults[selectedIndex]) {
        handleGuess(visibleResults[selectedIndex]);
        return;
      }

      const exactMatch = visibleResults.find(
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

  // The input is disabled until the user can submit a valid guess.
  const inputDisabled =
    !user ||
    gameStatus !== "IN_PROGRESS" ||
    (activeMode === "FRIEND_CHALLENGE" && !currentSessionId) ||
    (activeMode === "PRACTICE" && !practiceSessionId);
  const hintUnlockGuessesRemaining = Math.max(0, 3 - visibleGuesses.length);
  const canRequestHint =
    Boolean(user) &&
    gameStatus === "IN_PROGRESS" &&
    visibleHints.length < availableHints;

  // Shared compact table styles keep all clue columns inside the page width.
  const tableHeaderStyle = {
    padding: "0.65rem 0.45rem",
    color: "rgba(248, 250, 252, 0.82)",
    fontSize: "0.82rem",
    fontWeight: 800,
    lineHeight: 1.2,
    textAlign: "center" as const,
    overflowWrap: "break-word" as const,
    whiteSpace: "nowrap" as const,
    textTransform: "uppercase" as const,
  };

  const tableCellStyle = {
    padding: "0.78rem 0.55rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    lineHeight: 1.35,
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    overflowWrap: "break-word" as const,
    wordBreak: "break-word" as const,
    borderStyle: "solid",
    borderWidth: "1px 0 1px 1px",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 20px rgba(0, 10, 28, 0.18)",
  };

  // Rounded outer cells make each submitted guess read as one compact row.
  function getGuessCellStyle(
    statusStyle: ReturnType<typeof getStatusStyle>,
    position: "first" | "middle" | "last" = "middle"
  ) {
    return {
      ...statusStyle,
      ...tableCellStyle,
      borderRightWidth: position === "last" ? "1px" : 0,
      borderTopLeftRadius: position === "first" ? "10px" : 0,
      borderBottomLeftRadius: position === "first" ? "10px" : 0,
      borderTopRightRadius: position === "last" ? "10px" : 0,
      borderBottomRightRadius: position === "last" ? "10px" : 0,
    };
  }

  function getStrictGuessCellStyle(
    status: ComparisonStatus,
    position: "first" | "middle" | "last" = "middle"
  ) {
    return getGuessCellStyle(getStrictStatusStyle(status), position);
  };

  return (
    <div className="page">
      <div className="hero-panel">
        <div className="hero-content">
          <span className="eyebrow">KANNA PÅ, KANNA PÅ!</span>
          <h1 className="hero-title">Swedle</h1>
          <p className="hero-copy">
            Gissa den gömda svenska landsslagspelaren!
          </p>

          {!user && (
            <p className="notice">
              Du måste <Link to="/login">logga in</Link> för att spela.
            </p>
          )}

          {/* Mode buttons switch between the saved daily game and a new practice session. */}
          <div className="mode-switcher">
            <button
              onClick={loadDailyGame}
              disabled={!user}
              className={`mode-button ${activeMode === "DAILY" ? "is-active" : ""}`}
            >
              Dagens utmaning
            </button>

            <button
              onClick={startNewPracticeGame}
              disabled={!user}
              className={`mode-button ${activeMode === "PRACTICE" ? "is-active" : ""}`}
            >
              Slumpmässigt spel
            </button>
          </div>

          <p className="selected-mode">
            Valt spelläge:{" "}
            {activeMode === "DAILY"
              ? "Dagens utmaning"
              : activeMode === "FRIEND_CHALLENGE"
                ? "Vänutmaning"
                : "Slumpmässigt spel"}
          </p>

          {/* The backend marks a session as SOLVED after a correct guess. */}
          {gameStatus === "SOLVED" && (
            <p className="success-message">
              Bra gissat! Du klarade det på {guesses.length} {guesses.length === 1 ? "försök" : "försök"}.
            </p>
          )}

          {gameStatus === "FAILED" && (
            <p className="failed-message">
              Omgången är förlorad efter 8 gissningar.
            </p>
          )}

          {user && (
            <section className="hint-panel" aria-label="Ledtrådar">
              <div className="hint-panel-header">
                <div>
                  <h2>Ledtrådar</h2>
                  <p>
                    {gameStatus === "SOLVED"
                      ? "Spelet är löst, men dina använda ledtrådar sparas här."
                      : gameStatus === "FAILED"
                        ? "Omgången är avslutad, men dina använda ledtrådar sparas här."
                        : "Ledtrådar låses upp av dina gissningar och sparas i omgången."}
                  </p>
                </div>

                {gameStatus === "IN_PROGRESS" && hintUnlockGuessesRemaining > 0 && (
                  <span className="hint-lock">
                    Låses upp efter {hintUnlockGuessesRemaining} fler{" "}
                    {hintUnlockGuessesRemaining === 1 ? "gissning" : "gissningar"}
                  </span>
                )}

                {canRequestHint && (
                  <button className="button hint-button" onClick={handleRequestHint}>
                    Visa nästa ledtråd
                  </button>
                )}
              </div>

              {visibleHints.length > 0 ? (
                <ol className="hint-list">
                  {visibleHints.map((hint) => (
                    <li className="hint-card" key={hint.id}>
                      {hint.text}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="hint-empty">
                  Inga ledtrådar använda ännu.
                </p>
              )}
            </section>
          )}

          <div className="search-panel" style={{ position: "relative" }}>
            <label htmlFor="player-search" className="field-label">
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
              disabled={inputDisabled}
              className="input"
            />

            {!inputDisabled && visibleResults.length > 0 && (
              <ul className="suggestion-list">
                {visibleResults.map((player, index) => (
                  <li
                    key={player.id}
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    onClick={() => handleGuess(player)}
                    className={`suggestion-item ${selectedIndex === index ? "is-selected" : ""}`}
                  >
                    <strong>{player.fullName}</strong>
                    <div className="suggestion-meta">
                      {player.primaryPosition} • {player.birthYear ?? "Okänt"} •{" "}
                      {player.nationalTeamCaps} landskamper
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* API errors are shown near the search area so the user sees what failed. */}
      {error && <p className="error-message">{error}</p>}

      {/* The table appears only after the first guess has been submitted. */}
      {visibleGuesses.length > 0 && (
        <div className="guess-table-shell">
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 0.62rem",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Spelare</th>
                <th style={tableHeaderStyle}>Position</th>
                <th style={tableHeaderStyle}>Fot</th>
                <th style={tableHeaderStyle}>Tröjnummer</th>
                <th style={tableHeaderStyle}>Klubbar</th>
                <th style={tableHeaderStyle}>Födelseår</th>
                <th style={tableHeaderStyle}>Landskamper</th>
                <th style={tableHeaderStyle}>Mål</th>
              </tr>
            </thead>
            <tbody>
              {visibleGuesses.map((guess, index) => (
                <tr key={`${guess.guessedPlayer.id}-${index}`}>
                  <td
                    style={getGuessCellStyle(
                      getStatusStyle(guess.comparisons.fullName),
                      "first"
                    )}
                  >
                    {guess.guessedPlayer.fullName}
                  </td>
                  <td
                    style={getGuessCellStyle(
                      getStatusStyle(guess.comparisons.primaryPosition)
                    )}
                  >
                    {guess.guessedPlayer.primaryPosition}
                  </td>
                  <td
                    style={getGuessCellStyle(
                      getStatusStyle(guess.comparisons.dominantFoot)
                    )}
                  >
                    {guess.guessedPlayer.dominantFoot}
                  </td>
                  <td
                    style={getStrictGuessCellStyle(
                      guess.comparisons.swedenPrimaryShirtNumber
                    )}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.swedenPrimaryShirtNumber,
                      guess.comparisons.swedenPrimaryShirtNumber
                    )}
                  </td>
                  <td
                    style={getGuessCellStyle(getStatusStyle(guess.comparisons.clubs))}
                  >
                    {guess.guessedPlayer.clubsClueList.join(", ")}
                  </td>
                  <td
                    style={getStrictGuessCellStyle(guess.comparisons.birthYear)}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.birthYear,
                      guess.comparisons.birthYear
                    )}
                  </td>
                  <td
                    style={getStrictGuessCellStyle(guess.comparisons.nationalTeamCaps)}
                  >
                    {formatNumberWithHint(
                      guess.guessedPlayer.nationalTeamCaps,
                      guess.comparisons.nationalTeamCaps
                    )}
                  </td>
                  <td
                    style={getGuessCellStyle(
                      getStatusStyle(guess.comparisons.nationalTeamGoals),
                      "last"
                    )}
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
