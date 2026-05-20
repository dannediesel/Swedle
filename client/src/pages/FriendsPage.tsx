import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/useAuth";

type FriendUser = {
  id: string;
  username: string;
};

type FriendSearchResult = FriendUser & {
  friendshipStatus:
    | "NONE"
    | "FRIENDS"
    | "REQUEST_SENT"
    | "REQUEST_RECEIVED"
    | "REJECTED";
};

type FriendRequest = {
  id: string;
  requester?: FriendUser;
  receiver?: FriendUser;
  createdAt: string;
};

type FriendChallenge = {
  id: string;
  sessionId: string;
  creator: FriendUser;
  status: "IN_PROGRESS" | "SOLVED" | "FAILED";
  attempts: number;
  createdAt: string;
};

type FriendsDashboard = {
  friends: Array<FriendUser & { friendshipId: string }>;
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  incomingChallenges: FriendChallenge[];
};

function formatChallengeStatus(challenge: FriendChallenge) {
  if (challenge.status === "SOLVED") {
    return `Löst på ${challenge.attempts} försök`;
  }

  if (challenge.status === "FAILED") {
    return "Förlorad";
  }

  return "Inte spelad klart";
}

function formatSearchStatus(status: FriendSearchResult["friendshipStatus"]) {
  switch (status) {
    case "FRIENDS":
      return "Redan vän";
    case "REQUEST_SENT":
      return "Förfrågan skickad";
    case "REQUEST_RECEIVED":
      return "Väntar på ditt svar";
    case "REJECTED":
      return "Kan skickas igen";
    default:
      return "Lägg till";
  }
}

export default function FriendsPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<FriendsDashboard | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const data = await apiRequest<FriendsDashboard>("/api/friends");
      setDashboard(data);
      setError("");
    } catch {
      setError("Kunde inte ladda vänner.");
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isCurrentRequest = true;

    apiRequest<FriendsDashboard>("/api/friends")
      .then((data) => {
        if (!isCurrentRequest) {
          return;
        }

        setDashboard(data);
        setError("");
      })
      .catch(() => {
        if (!isCurrentRequest) {
          return;
        }

        setError("Kunde inte ladda vänner.");
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || query.trim().length < 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      apiRequest<FriendSearchResult[]>(
        `/api/friends/search?q=${encodeURIComponent(query.trim())}`
      )
        .then((data) => {
          setResults(data);
          setError("");
        })
        .catch(() => setError("Kunde inte söka användare."));
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query, user]);

  async function sendRequest(username: string) {
    try {
      const data = await apiRequest<FriendsDashboard>("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      setDashboard(data);
      setMessage(`Vänförfrågan skickad till ${username}.`);
      setError("");
    } catch {
      setError("Kunde inte skicka vänförfrågan.");
    }
  }

  async function respondToRequest(friendshipId: string, action: "accept" | "reject") {
    try {
      const data = await apiRequest<FriendsDashboard>(
        `/api/friends/requests/${friendshipId}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        }
      );

      setDashboard(data);
      setMessage(action === "accept" ? "Vänförfrågan accepterad." : "Vänförfrågan avvisad.");
      setError("");
    } catch {
      setError("Kunde inte svara på vänförfrågan.");
    }
  }

  async function challengeFriend(friend: FriendUser) {
    try {
      await apiRequest<FriendChallenge>(`/api/friends/${friend.id}/challenges`, {
        method: "POST",
      });

      setMessage(`Utmaning skickad till ${friend.username}.`);
      setError("");
      loadDashboard();
    } catch {
      setError("Kunde inte skapa utmaningen.");
    }
  }

  if (!user) {
    return (
      <main className="auth-card">
        <h1>Vänner</h1>
        <p className="hero-copy">
          Du måste <Link to="/login">logga in</Link> för att lägga till vänner.
        </p>
      </main>
    );
  }

  return (
    <main className="friends-page">
      <section className="friends-header">
        <div>
          <span className="eyebrow">Prova att utmana en vän!</span>
          <h1>Vänner</h1>
          <p className="hero-copy">
            Lägg till andra användare, acceptera vänförfrågningar och skicka
            direkta Swedle-utmaningar.
          </p>
        </div>
      </section>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      <section className="friends-grid">
        <div className="friend-panel">
          <h2>Sök användare</h2>
          <label className="field-label" htmlFor="friend-search">
            Användarnamn
          </label>
          <input
            id="friend-search"
            className="input"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);

              if (nextQuery.trim().length < 2) {
                setResults([]);
              }
            }}
            placeholder="Skriv minst två bokstäver..."
          />

          <div className="friend-list">
            {results.map((result) => (
              <div className="friend-row" key={result.id}>
                <div>
                  <strong>{result.username}</strong>
                  <span>{formatSearchStatus(result.friendshipStatus)}</span>
                </div>
                <button
                  className="button"
                  disabled={
                    result.friendshipStatus === "FRIENDS" ||
                    result.friendshipStatus === "REQUEST_SENT" ||
                    result.friendshipStatus === "REQUEST_RECEIVED"
                  }
                  onClick={() => sendRequest(result.username)}
                >
                  Lägg till
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="friend-panel">
          <h2>Vänförfrågningar</h2>
          {dashboard?.incomingRequests.length ? (
            <div className="friend-list">
              {dashboard.incomingRequests.map((request) => (
                <div className="friend-row" key={request.id}>
                  <div>
                    <strong>{request.requester?.username}</strong>
                    <span>Vill bli vän</span>
                  </div>
                  <div className="friend-actions">
                    <button
                      className="button"
                      onClick={() => respondToRequest(request.id, "accept")}
                    >
                      Acceptera
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => respondToRequest(request.id, "reject")}
                    >
                      Avvisa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="friend-empty">Inga inkommande förfrågningar.</p>
          )}

          {Boolean(dashboard?.outgoingRequests.length) && (
            <>
              <h3>Skickade</h3>
              <div className="friend-list">
                {dashboard?.outgoingRequests.map((request) => (
                  <div className="friend-row" key={request.id}>
                    <div>
                      <strong>{request.receiver?.username}</strong>
                      <span>Väntar på svar</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="friend-panel">
          <h2>Mina vänner</h2>
          {dashboard?.friends.length ? (
            <div className="friend-list">
              {dashboard.friends.map((friend) => (
                <div className="friend-row" key={friend.id}>
                  <div>
                    <strong>{friend.username}</strong>
                    <span>Redo för utmaning</span>
                  </div>
                  <button className="button" onClick={() => challengeFriend(friend)}>
                    Utmana
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="friend-empty">Lägg till en vän för att kunna utmana någon.</p>
          )}
        </div>

        <div className="friend-panel">
          <h2>Inkommande utmaningar</h2>
          {dashboard?.incomingChallenges.length ? (
            <div className="friend-list">
              {dashboard.incomingChallenges.map((challenge) => (
                <div className="friend-row" key={challenge.id}>
                  <div>
                    <strong>{challenge.creator.username}</strong>
                    <span>{formatChallengeStatus(challenge)}</span>
                  </div>
                  <Link className="button" to={`/challenge/${challenge.sessionId}`}>
                    Spela
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="friend-empty">Du har inga utmaningar ännu.</p>
          )}
        </div>
      </section>
    </main>
  );
}
