import { GameMode, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

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
  return date.toISOString().slice(0, 10);
}

// Count how many calendar days there are between two dates.
function getDayDifference(previousDate: Date, currentDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;

  const previous = new Date(previousDate);
  previous.setHours(0, 0, 0, 0);

  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);

  return Math.round((current.getTime() - previous.getTime()) / msPerDay);
}

// Finds the longest run of solved daily games.
function calculateBestStreak(solvedDates: Date[]): number {
  if (solvedDates.length === 0) {
    return 0;
  }

  const sortedDates = [...solvedDates].sort(
    (a, b) => a.getTime() - b.getTime()
  );

  let bestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = getDayDifference(sortedDates[i - 1], sortedDates[i]);

    if (diff === 1) {
      currentStreak += 1;
    } else if (diff > 1) {
      currentStreak = 1;
    }

    bestStreak = Math.max(bestStreak, currentStreak);
  }

  return bestStreak;
}

// Counts solved days backwards from today until the streak breaks.
function calculateCurrentStreak(solvedDateKeys: Set<string>): number {
  let streak = 0;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  while (true) {
    const key = toDateKey(currentDate);

    if (!solvedDateKeys.has(key)) {
      break;
    }

    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

// Builds all user-facing stats from the user's saved daily game sessions.
export async function getStatsForUser(userId: string): Promise<UserStats> {
  // Only count daily sessions where the user has made at least one guess.
  const sessions = await prisma.gameSession.findMany({
    where: {
      userId,
      mode: GameMode.DAILY,
      attempts: {
        gt: 0,
      },
    },
    include: {
      dailyChallenge: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const gamesPlayed = sessions.length;

  const solvedSessions = sessions.filter(
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

  const solvedDailyDates = solvedSessions
    .map((session) => session.dailyChallenge?.date)
    .filter((date): date is Date => Boolean(date));

  const solvedDateKeys = new Set(solvedDailyDates.map(toDateKey));

  const currentStreak = calculateCurrentStreak(solvedDateKeys);
  const bestStreak = calculateBestStreak(solvedDailyDates);

  // Keep the recent-games table small on the stats page.
  const recentGames = sessions.slice(0, 10).map((session) => ({
    id: session.id,
    date: session.dailyChallenge
      ? toDateKey(session.dailyChallenge.date)
      : toDateKey(session.createdAt),
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
