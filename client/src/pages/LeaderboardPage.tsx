import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/useAuth";

type LeaderboardEntry = {
  rank: number | null;
  userId: string;
  username: string;
  completedGames: number;
  wins: number;
  winRate: number;
  totalScore: number | null;
  averageScore: number | null;
  isQualified: boolean;
  isCurrentUser: boolean;
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    apiRequest<LeaderboardEntry[]>("/api/stats/leaderboard")
      .then((data) => {
        setLeaderboard(data);
        setError("");
      })
      .catch(() => {
        setError("Kunde inte ladda topplistan.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user]);

  if (!user) {
    return (
      <div className="stats-page leaderboard-page">
        <h1>Topplista</h1>
        <p>
          Du måste <Link to="/login">logga in</Link> för att se topplistan.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="stats-page leaderboard-page">
        <h1>Topplista</h1>
        <p>Laddar topplista...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-page leaderboard-page">
        <h1>Topplista</h1>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  const rankedEntries = leaderboard.filter((entry) => entry.rank !== null);
  const unrankedEntries = leaderboard.filter((entry) => entry.rank === null);

  return (
    <div className="stats-page leaderboard-page">
      <h1>Topplista</h1>
      <p>
        All time-ranking efter lägst snitt per avslutat spel. Förluster räknas
        som 9 och minst 5 spel krävs för rank.
      </p>

      {leaderboard.length === 0 ? (
        <p>Inga spelare ännu.</p>
      ) : (
        <div className="stats-table-shell">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "720px",
            }}
          >
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Rank</th>
                <th style={tableHeaderStyle}>Spelare</th>
                <th style={tableHeaderStyle}>Snitt</th>
                <th style={tableHeaderStyle}>Spelade</th>
                <th style={tableHeaderStyle}>Vinstprocent</th>
                <th style={tableHeaderStyle}>Poäng</th>
              </tr>
            </thead>
            <tbody>
              {[...rankedEntries, ...unrankedEntries].map((entry) => (
                <tr
                  className={entry.isCurrentUser ? "leaderboard-current-row" : ""}
                  key={entry.userId}
                >
                  <td style={tableCellStyle}>
                    <span className="leaderboard-rank">
                      {entry.rank ? `#${entry.rank}` : "-"}
                    </span>
                  </td>
                  <td style={tableCellStyle}>
                    <strong className="leaderboard-user-cell">
                      {entry.username}
                      {entry.isCurrentUser ? " (du)" : ""}
                    </strong>
                  </td>
                  <td style={tableCellStyle}>{entry.averageScore ?? "-"}</td>
                  <td style={tableCellStyle}>
                    {entry.completedGames}
                    {!entry.isQualified && (
                      <span className="leaderboard-qualification-note">
                        {" "}
                        / 5
                      </span>
                    )}
                  </td>
                  <td style={tableCellStyle}>{entry.winRate}%</td>
                  <td style={tableCellStyle}>{entry.totalScore ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const tableHeaderStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.75rem",
  color: "#003a6b",
  borderBottom: "2px solid rgba(0, 82, 147, 0.2)",
};

const tableCellStyle: CSSProperties = {
  padding: "0.75rem",
  borderBottom: "1px solid rgba(0, 82, 147, 0.12)",
};
