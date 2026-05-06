import { GameMode, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { MAX_GUESSES } from "../constants/gameRules";

export type UserStats = {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  averageGuesses: number | null;
  recentGames: {
    id: string;
    date: string;
    mode: GameMode;
    status: SessionStatus;
    attempts: number;
    targetPlayerName: string;
  }[];
};

// Convert dates to YYYY-MM-DD so streaks compare whole days, not exact timestamps.
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getSessionDate(session: {
  createdAt: Date;
  dailyChallenge: { date: Date } | null;
}) {
  return session.dailyChallenge ? session.dailyChallenge.date : session.createdAt;
}

function getEffectiveStatus(session: {
  status: SessionStatus;
  attempts: number;
}): SessionStatus {
  if (session.attempts > MAX_GUESSES) {
    return SessionStatus.FAILED;
  }

  return session.status;
}

// Counts solved games backwards from the latest played game until the streak breaks.
function calculateCurrentStreak(sessions: { status: SessionStatus }[]): number {
  let streak = 0;

  for (const session of sessions) {
    if (session.status !== SessionStatus.SOLVED) {
      break;
    }

    streak += 1;
  }

  return streak;
}

// Finds the longest run of solved games across the user's played sessions.
function calculateBestStreak(sessions: { status: SessionStatus }[]): number {
  let bestStreak = 0;
  let currentStreak = 0;

  for (const session of sessions) {
    if (session.status === SessionStatus.SOLVED) {
      currentStreak += 1;
    } else {
      currentStreak = 0;
    }

    bestStreak = Math.max(bestStreak, currentStreak);
  }

  return bestStreak;
}

// Builds all user-facing stats from the user's saved game sessions.
export async function getStatsForUser(userId: string): Promise<UserStats> {
  const today = getTodayDate();

  // Show today's daily session even before the first guess, so Stats can say it is ongoing.
  // Practice games appear when they have reached a final state.
  const visibleSessions = await prisma.gameSession.findMany({
    where: {
      userId,
      OR: [
        {
          mode: GameMode.DAILY,
          attempts: {
            gt: 0,
          },
        },
        {
          mode: GameMode.DAILY,
          dailyChallenge: {
            date: today,
          },
        },
        {
          mode: GameMode.PRACTICE,
          status: {
            in: [SessionStatus.SOLVED, SessionStatus.FAILED],
          },
        },
      ],
    },
    include: {
      dailyChallenge: true,
    },
  });

  // Sort by the actual game date, newest first. updatedAt is only a tie-breaker.
  const sortedVisibleSessions = [...visibleSessions].sort((a, b) => {
    const dateComparison = toDateKey(getSessionDate(b)).localeCompare(
      toDateKey(getSessionDate(a))
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const normalizedVisibleSessions = sortedVisibleSessions.map((session) => ({
    ...session,
    status: getEffectiveStatus(session),
  }));

  // Totals count actually played rounds; opening today's daily without guessing is not counted.
  const countedSessions = normalizedVisibleSessions.filter((session) => {
    if (session.mode === GameMode.DAILY) {
      return session.attempts > 0;
    }

    return (
      session.status === SessionStatus.SOLVED ||
      session.status === SessionStatus.FAILED
    );
  });

  const gamesPlayed = countedSessions.length;

  const solvedSessions = countedSessions.filter(
    (session) => session.status === SessionStatus.SOLVED
  );

  const wins = solvedSessions.length;

  const winRate =
    gamesPlayed === 0 ? 0 : Math.round((wins / gamesPlayed) * 100);

  const totalAttemptsForWins = solvedSessions.reduce(
    (sum, session) => sum + session.attempts,
    0
  );

  const averageGuesses =
    wins === 0 ? null : Number((totalAttemptsForWins / wins).toFixed(2));

  const currentStreak = calculateCurrentStreak(countedSessions);
  const bestStreak = calculateBestStreak([...countedSessions].reverse());

  // Keep the recent-games table small on the stats page.
  const recentGames = normalizedVisibleSessions.slice(0, 10).map((session) => ({
    id: session.id,
    date: toDateKey(getSessionDate(session)),
    mode: session.mode,
    status: session.status,
    attempts: session.attempts,
    targetPlayerName: session.targetPlayerName,
  }));

  return {
    gamesPlayed,
    wins,
    winRate,
    currentStreak,
    bestStreak,
    averageGuesses,
    recentGames,
  };
}
