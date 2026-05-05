import { GameMode, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { Player } from "../types/player";
import {
  getAllPlayers,
  getPlayerByFullName,
  getPlayerById,
} from "./playerService";

// Temporary MVP target. Later this should come from DailyChallenge in the database.
const DAILY_TARGET_PLAYER_NAME = "Andreas Granqvist";

// These statuses tell the frontend how to color a cell or show higher/lower hints.
type ComparisonStatus = "correct" | "incorrect" | "higher" | "lower" | "partial";

// Complete response shape returned after a user submits one guess.
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

export type GameState = {
  sessionId: string;
  mode: GameMode;
  status: SessionStatus;
  attempts: number;
  guesses: GuessResult[];
};

// Store daily challenges by date without a time component.
function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// Text fields are currently compared by exact match.
function compareText(guessed: string, target: string): ComparisonStatus {
  return guessed === target ? "correct" : "incorrect";
}

// Numeric clues can be exact, or tell the user whether the target value is higher or lower.
function compareNullableNumber(
  guessed: number | null,
  target: number | null
): ComparisonStatus {
  if (guessed === null || target === null) {
    return "incorrect";
  }

  if (guessed === target) {
    return "correct";
  }

  return guessed < target ? "higher" : "lower";
}

// Normalize club names so small spelling differences do not block a reasonable match.
// For example, accents and common club suffixes like IF/FF/FK are ignored.
function normalizeClubName(club: string): string {
  return club
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(if|ff|fk|sk|bk|fc|cf|afc|ac|sc|ik|gif|goif|bois)\b/g, " ")
    .replace(/\bdjurgardens\b/g, "djurgarden")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClubList(clubs: string[]): string[] {
  return clubs.map(normalizeClubName).filter((club) => club.length > 0);
}

// Club feedback is partial when the guessed player and target player share at least one club.
function compareClubLists(
  guessedClubs: string[],
  targetClubs: string[]
): ComparisonStatus {
  const guessedSet = new Set(normalizeClubList(guessedClubs));
  const hasMatch = normalizeClubList(targetClubs).some((club) => guessedSet.has(club));

  return hasMatch ? "partial" : "incorrect";
}

function comparePlayers(guessedPlayer: Player, targetPlayer: Player): GuessResult {
  const isCorrect = guessedPlayer.id === targetPlayer.id;

  return {
    guessedPlayer,
    isCorrect,
    comparisons: {
      fullName: isCorrect ? "correct" : "incorrect",
      primaryPosition: compareText(
        guessedPlayer.primaryPosition,
        targetPlayer.primaryPosition
      ),
      dominantFoot: compareText(guessedPlayer.dominantFoot, targetPlayer.dominantFoot),
      swedenPrimaryShirtNumber: compareNullableNumber(
        guessedPlayer.swedenPrimaryShirtNumber,
        targetPlayer.swedenPrimaryShirtNumber
      ),
      clubs: isCorrect
        ? "correct"
        : compareClubLists(guessedPlayer.clubsClueList, targetPlayer.clubsClueList),
      birthYear: compareNullableNumber(guessedPlayer.birthYear, targetPlayer.birthYear),
      nationalTeamCaps: compareNullableNumber(
        guessedPlayer.nationalTeamCaps,
        targetPlayer.nationalTeamCaps
      ),
      nationalTeamGoals: compareNullableNumber(
        guessedPlayer.nationalTeamGoals,
        targetPlayer.nationalTeamGoals
      ),
    },
  };
}

// Rebuild the full frontend state for a session from saved guesses in the database.
async function buildGameState(sessionId: string): Promise<GameState> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Game session not found");
  }

  const targetPlayer = await getPlayerByFullName(session.targetPlayerName);

  if (!targetPlayer) {
    throw new Error("Target player not found");
  }

  // Guesses are stored as names, then compared again so the frontend gets all clue feedback.
  const guesses = await prisma.guess.findMany({
    where: {
      gameSessionId: session.id,
    },
    orderBy: {
      guessOrder: "asc",
    },
  });

  const guessResults: GuessResult[] = [];

  for (const guess of guesses) {
    const guessedPlayer = await getPlayerByFullName(guess.guessedPlayerName);

    if (guessedPlayer) {
      guessResults.push(comparePlayers(guessedPlayer, targetPlayer));
    }
  }

  return {
    sessionId: session.id,
    mode: session.mode,
    status: session.status,
    attempts: session.attempts,
    guesses: guessResults,
  };
}

// Shared submit logic for both daily and practice games.
async function submitGuessToSession(
  sessionId: string,
  userId: string,
  playerId: number
): Promise<GameState> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Game session not found");
  }

  // Users may only submit guesses to their own sessions.
  if (session.userId !== userId) {
    throw new Error("Not allowed to access this game session");
  }

  if (session.status === SessionStatus.SOLVED) {
    throw new Error("Game session already solved");
  }

  const guessedPlayer = await getPlayerById(playerId);
  const targetPlayer = await getPlayerByFullName(session.targetPlayerName);

  if (!guessedPlayer) {
    throw new Error("Guessed player not found");
  }

  if (!targetPlayer) {
    throw new Error("Target player not found");
  }

  // Do not allow the same player to be guessed twice in one session.
  const existingGuess = await prisma.guess.findFirst({
    where: {
      gameSessionId: session.id,
      guessedPlayerName: guessedPlayer.fullName,
    },
  });

  if (existingGuess) {
    throw new Error("Player already guessed");
  }

  const previousGuessCount = await prisma.guess.count({
    where: {
      gameSessionId: session.id,
    },
  });

  const guessOrder = previousGuessCount + 1;
  const guessResult = comparePlayers(guessedPlayer, targetPlayer);

  // Save the guess before updating the session summary.
  await prisma.guess.create({
    data: {
      gameSessionId: session.id,
      guessedPlayerName: guessedPlayer.fullName,
      guessOrder,
    },
  });

  // Mark the session as solved when the guessed player is the target.
  await prisma.gameSession.update({
    where: {
      id: session.id,
    },
    data: {
      attempts: guessOrder,
      status: guessResult.isCorrect ? SessionStatus.SOLVED : SessionStatus.IN_PROGRESS,
      completedAt: guessResult.isCorrect ? new Date() : null,
    },
  });

  return buildGameState(session.id);
}

// Daily mode
async function getOrCreateDailyChallenge() {
  const today = getTodayDate();

  // Reuse today's challenge if it already exists in the database.
  const existingChallenge = await prisma.dailyChallenge.findUnique({
    where: { date: today },
  });

  if (existingChallenge) {
    // During the MVP the daily target is controlled by the constant above.
    // If it changes in code, keep today's database row in sync.
    if (existingChallenge.targetPlayerName !== DAILY_TARGET_PLAYER_NAME) {
      return prisma.dailyChallenge.update({
        where: { id: existingChallenge.id },
        data: {
          targetPlayerName: DAILY_TARGET_PLAYER_NAME,
        },
      });
    }

    return existingChallenge;
  }

  // For now the daily challenge always uses the MVP target player.
  return prisma.dailyChallenge.create({
    data: {
      date: today,
      targetPlayerName: DAILY_TARGET_PLAYER_NAME,
    },
  });
}

async function getOrCreateDailySession(userId: string) {
  const dailyChallenge = await getOrCreateDailyChallenge();

  // Each user gets one session per daily challenge.
  const existingSession = await prisma.gameSession.findFirst({
    where: {
      userId,
      dailyChallengeId: dailyChallenge.id,
    },
  });

  if (existingSession) {
    // Keep in-progress sessions aligned with today's challenge target.
    if (
      existingSession.status === SessionStatus.IN_PROGRESS &&
      existingSession.targetPlayerName !== dailyChallenge.targetPlayerName
    ) {
      return prisma.gameSession.update({
        where: { id: existingSession.id },
        data: {
          targetPlayerName: dailyChallenge.targetPlayerName,
        },
      });
    }

    return existingSession;
  }

  // Start a new in-progress session for this user and date.
  return prisma.gameSession.create({
    data: {
      userId,
      dailyChallengeId: dailyChallenge.id,
      mode: GameMode.DAILY,
      targetPlayerName: dailyChallenge.targetPlayerName,
      status: SessionStatus.IN_PROGRESS,
    },
  });
}

export async function getDailyGameState(userId: string): Promise<GameState> {
  const session = await getOrCreateDailySession(userId);
  return buildGameState(session.id);
}

export async function submitDailyGuess(
  userId: string,
  playerId: number
): Promise<GameState> {
  const session = await getOrCreateDailySession(userId);
  return submitGuessToSession(session.id, userId, playerId);
}

// Practice mode

// Practice games use a random target, unlike daily games which share one target per day.
async function getRandomPlayer(): Promise<Player> {
  const players = await getAllPlayers();

  if (players.length === 0) {
    throw new Error("No players available");
  }

  const randomIndex = Math.floor(Math.random() * players.length);
  return players[randomIndex];
}

// Create a new practice session for the user.
export async function createPracticeGame(userId: string): Promise<GameState> {
  const targetPlayer = await getRandomPlayer();

  const session = await prisma.gameSession.create({
    data: {
      userId,
      mode: GameMode.PRACTICE,
      targetPlayerName: targetPlayer.fullName,
      status: SessionStatus.IN_PROGRESS,
    },
  });

  return buildGameState(session.id);
}

// Load a practice session only if it belongs to the current user.
export async function getPracticeGameState(
  userId: string,
  sessionId: string
): Promise<GameState> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Game session not found");
  }

  if (session.userId !== userId) {
    throw new Error("Not allowed to access this game session");
  }

  if (session.mode !== GameMode.PRACTICE) {
    throw new Error("This is not a practice session");
  }

  return buildGameState(session.id);
}

// Submit a guess to a practice session.
export async function submitPracticeGuess(
  userId: string,
  sessionId: string,
  playerId: number
): Promise<GameState> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Game session not found");
  }

  if (session.mode !== GameMode.PRACTICE) {
    throw new Error("This is not a practice session");
  }

  return submitGuessToSession(session.id, userId, playerId);
}
