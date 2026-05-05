import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/useAuth";

// Shape returned by GET /api/stats/me.
type UserStats = {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  averageGuesses: number | null;
  recentGames: {
    id: string;
    date: string;
    mode: "DAILY" | "FRIEND_CHALLENGE" | "PRACTICE";
    status: "IN_PROGRESS" | "SOLVED" | "FAILED";
    attempts: number;
    targetPlayerName: string;
  }[];
};

// Shows the logged-in user's personal game statistics.
export default function StatsPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    // apiRequest adds the saved auth token, so this can call the protected stats route.
    apiRequest<UserStats>("/api/stats/me")
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        setError("Could not load statistics.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user]);

  if (!user) {
    return (
      <div style={{ maxWidth: "900px", margin: "3rem auto", padding: "2rem" }}>
        <h1>Statistik</h1>
        <p>
          Du måste <Link to="/login">logga in</Link> för att se din statistik.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: "900px", margin: "3rem auto", padding: "2rem" }}>
        <h1>Statistik</h1>
        <p>Laddar statistik...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "900px", margin: "3rem auto", padding: "2rem" }}>
        <h1>Statistik</h1>
        <p style={{ color: "#ff6b6b" }}>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "3rem auto", padding: "2rem" }}>
      <h1> Din statistik</h1>
      <p>Håll koll på dina prestationer över tid i alla spellägen.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(10px, 1fr))",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        <StatCard label="Totalt spelade" value={stats.gamesPlayed} />
        <StatCard label="Vinster" value={stats.wins} />
        <StatCard label="Vinstprocent" value={`${stats.winRate}%`} />
        <StatCard label="Nuvarande streak" value={stats.currentStreak} />
        <StatCard label="Bästa streak" value={stats.bestStreak} />
        <StatCard
          label="Genomsnittliga gissningar"
          value={stats.averageGuesses ?? "-"}
        />
      </div>

      <h2 style={{ marginTop: "3rem" }}>Senaste spel</h2>

      {stats.recentGames.length === 0 ? (
        <p>Inga spel spelade ännu.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "700px",
            }}
          >
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Datum</th>
                <th style={tableHeaderStyle}>Läge</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Försök</th>
                <th style={tableHeaderStyle}>Mål</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentGames.map((game) => (
                <tr key={game.id}>
                  <td style={tableCellStyle}>{game.date}</td>
                  <td style={tableCellStyle}>{formatMode(game.mode)}</td>
                  <td style={tableCellStyle}>{formatStatus(game)}</td>
                  <td style={tableCellStyle}>{game.attempts}</td>
                  <td style={tableCellStyle}>{shouldShowTarget(game) ? game.targetPlayerName : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Small reusable card for one statistic number.
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: "12px",
        padding: "1.25rem",
        backgroundColor: "#151923",
      }}
    >
      <div style={{ fontSize: "0.9rem", color: "#a1a1aa" }}>{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "0.5rem" }}>
        {value}
      </div>
    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem",
  borderBottom: "1px solid #333",
};

const tableCellStyle: React.CSSProperties = {
  padding: "0.75rem",
  borderBottom: "1px solid #333",
};

function formatMode(mode: UserStats["recentGames"][number]["mode"]) {
  if (mode === "DAILY") return "Dagens utmaning";
  if (mode === "FRIEND_CHALLENGE") return "Vänutmaning";
  return "Slumpmässigt spel";
}

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatStatus(game: UserStats["recentGames"][number]) {
  if (game.status === "SOLVED") return "Löst";
  if (game.status === "FAILED") return "Misslyckat";

  // A daily game that is still in progress after its date has passed can no longer be solved.
  if (game.mode === "DAILY" && game.date < getTodayDateKey()) {
    return "Olöst";
  }

  return "Pågående";
}

function shouldShowTarget(game: UserStats["recentGames"][number]) {
  if (game.status === "SOLVED" || game.status === "FAILED") {
    return true;
  }

  // Old daily challenges are no longer playable, so their target can be shown.
  return game.mode === "DAILY" && game.date < getTodayDateKey();
}
