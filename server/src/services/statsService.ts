import { GameMode, Prisma, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { MAX_GUESSES } from "../constants/gameRules";

type FriendChallengeResult = "WIN" | "LOSS" | "DRAW" | "PENDING";
type LeaderboardGameValue = {
  scoreValue: number;
  isWin: boolean;
};

const LEADERBOARD_MIN_COMPLETED_GAMES = 5;
const LEADERBOARD_LOSS_SCORE = MAX_GUESSES + 1;

export type LeaderboardEntry = {
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
    friendChallengeResult: FriendChallengeResult | null;
  }[];
};

const statsSessionInclude = {
  dailyChallenge: true,
  friendChallengeAttempts: {
    include: {
      friendChallenge: {
        include: {
          attempts: {
            include: {
              gameSession: {
                select: {
                  id: true,
                  status: true,
                  attempts: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GameSessionInclude;

type StatsSession = Prisma.GameSessionGetPayload<{
  include: typeof statsSessionInclude;
}>;

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

function isFinished(status: SessionStatus) {
  return status === SessionStatus.SOLVED || status === SessionStatus.FAILED;
}

function getFriendChallengeResult(
  session: StatsSession
): FriendChallengeResult | null {
  if (session.mode !== GameMode.FRIEND_CHALLENGE) {
    return null;
  }

  const challengeAttempt = session.friendChallengeAttempts[0];
  const opponentAttempt = challengeAttempt?.friendChallenge.attempts.find(
    (attempt) => attempt.gameSession.id !== session.id
  );

  if (!opponentAttempt) {
    return null;
  }

  const myStatus = getEffectiveStatus(session);
  const opponentStatus = getEffectiveStatus(opponentAttempt.gameSession);

  if (!isFinished(myStatus) || !isFinished(opponentStatus)) {
    return "PENDING";
  }

  if (
    myStatus === SessionStatus.FAILED &&
    opponentStatus === SessionStatus.FAILED
  ) {
    return "DRAW";
  }

  if (myStatus === SessionStatus.FAILED) {
    return "LOSS";
  }

  if (opponentStatus === SessionStatus.FAILED) {
    return "WIN";
  }

  if (session.attempts < opponentAttempt.gameSession.attempts) {
    return "WIN";
  }

  if (session.attempts > opponentAttempt.gameSession.attempts) {
    return "LOSS";
  }

  return "DRAW";
}

function isStatsWin(session: StatsSession) {
  if (session.mode === GameMode.FRIEND_CHALLENGE) {
    return getFriendChallengeResult(session) === "WIN";
  }

  return session.status === SessionStatus.SOLVED;
}

function toStreakStatus(session: StatsSession): SessionStatus {
  if (session.mode !== GameMode.FRIEND_CHALLENGE) {
    return session.status;
  }

  return getFriendChallengeResult(session) === "WIN"
    ? SessionStatus.SOLVED
    : SessionStatus.FAILED;
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
        {
          mode: GameMode.FRIEND_CHALLENGE,
        },
      ],
    },
    include: statsSessionInclude,
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
    if (
      session.mode === GameMode.DAILY ||
      session.mode === GameMode.FRIEND_CHALLENGE
    ) {
      return session.attempts > 0;
    }

    return (
      session.status === SessionStatus.SOLVED ||
      session.status === SessionStatus.FAILED
    );
  });

  const gamesPlayed = countedSessions.length;

  const solvedSessions = countedSessions.filter(
    (session) => isStatsWin(session)
  );

  const wins = solvedSessions.length;

  const winRate =
    gamesPlayed === 0 ? 0 : Math.round((wins / gamesPlayed) * 100);

  const totalAttemptsForPlayedGames = countedSessions.reduce(
    (sum, session) => sum + session.attempts,
    0
  );

  const averageGuesses =
    gamesPlayed === 0
      ? null
      : Number((totalAttemptsForPlayedGames / gamesPlayed).toFixed(2));

  const streakSessions = countedSessions.map((session) => ({
    status: toStreakStatus(session),
  }));

  const currentStreak = calculateCurrentStreak(streakSessions);
  const bestStreak = calculateBestStreak([...streakSessions].reverse());

  // Keep the recent-games table small on the stats page.
  const recentGames = normalizedVisibleSessions.slice(0, 10).map((session) => ({
    id: session.id,
    date: toDateKey(getSessionDate(session)),
    mode: session.mode,
    status: session.status,
    attempts: session.attempts,
    targetPlayerName: session.targetPlayerName,
    friendChallengeResult: getFriendChallengeResult(session),
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

export async function getLeaderboardForUser(
  currentUserId: string
): Promise<LeaderboardEntry[]> {
  const today = getTodayDate();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      gameSessions: {
        where: {
          attempts: {
            gt: 0,
          },
          OR: [
            {
              mode: GameMode.DAILY,
            },
            {
              mode: GameMode.PRACTICE,
              status: {
                in: [SessionStatus.SOLVED, SessionStatus.FAILED],
              },
            },
            {
              mode: GameMode.PRACTICE,
              attempts: {
                gt: MAX_GUESSES,
              },
            },
            {
              mode: GameMode.FRIEND_CHALLENGE,
            },
          ],
        },
        include: statsSessionInclude,
      },
    },
  });

  const leaderboard = users
    .map((user) => {
      const gameValues = user.gameSessions
        .map((session) => getLeaderboardGameValue(session, today))
        .filter((value): value is LeaderboardGameValue => value !== null);
      const completedGames = gameValues.length;
      const wins = gameValues.filter((value) => value.isWin).length;
      const totalScore = gameValues.reduce(
        (sum, value) => sum + value.scoreValue,
        0
      );
      const isQualified = completedGames >= LEADERBOARD_MIN_COMPLETED_GAMES;

      return {
        rank: null,
        userId: user.id,
        username: user.username,
        completedGames,
        wins,
        winRate:
          completedGames > 0 ? Math.round((wins / completedGames) * 100) : 0,
        totalScore: completedGames > 0 ? totalScore : null,
        averageScore:
          completedGames > 0
            ? Number((totalScore / completedGames).toFixed(2))
            : null,
        isQualified,
        isCurrentUser: user.id === currentUserId,
      } satisfies LeaderboardEntry;
    })
    .filter((entry) => entry.completedGames > 0)
    .sort((a, b) => {
      if (a.isQualified !== b.isQualified) {
        return a.isQualified ? -1 : 1;
      }

      if (a.averageScore !== null && b.averageScore !== null) {
        if (a.averageScore !== b.averageScore) {
          return a.averageScore - b.averageScore;
        }
      }

      if (a.averageScore !== null && b.averageScore === null) {
        return -1;
      }

      if (a.averageScore === null && b.averageScore !== null) {
        return 1;
      }

      if (a.completedGames !== b.completedGames) {
        return b.completedGames - a.completedGames;
      }

      if (a.winRate !== b.winRate) {
        return b.winRate - a.winRate;
      }

      return a.username.localeCompare(b.username, "sv");
    });

  let nextRank = 1;

  return leaderboard.map((entry) => {
    if (!entry.isQualified) {
      return entry;
    }

    return {
      ...entry,
      rank: nextRank++,
    };
  });
}

function getLeaderboardGameValue(
  session: StatsSession,
  today: Date
): LeaderboardGameValue | null {
  const status = getEffectiveStatus(session);

  if (session.mode === GameMode.FRIEND_CHALLENGE) {
    const challengeResult = getFriendChallengeResult(session);

    if (challengeResult === "PENDING" || challengeResult === null) {
      return null;
    }

    if (challengeResult === "LOSS") {
      return {
        scoreValue: LEADERBOARD_LOSS_SCORE,
        isWin: false,
      };
    }

    if (challengeResult === "WIN") {
      return {
        scoreValue: session.attempts,
        isWin: true,
      };
    }

    return {
      scoreValue:
        status === SessionStatus.SOLVED
          ? session.attempts
          : LEADERBOARD_LOSS_SCORE,
      isWin: false,
    };
  }

  if (session.mode === GameMode.DAILY && status === SessionStatus.IN_PROGRESS) {
    if (toDateKey(getSessionDate(session)) < toDateKey(today)) {
      return {
        scoreValue: LEADERBOARD_LOSS_SCORE,
        isWin: false,
      };
    }

    return null;
  }

  if (status === SessionStatus.SOLVED) {
    return {
      scoreValue: session.attempts,
      isWin: true,
    };
  }

  if (status === SessionStatus.FAILED) {
    return {
      scoreValue: LEADERBOARD_LOSS_SCORE,
      isWin: false,
    };
  }

  return null;
}
