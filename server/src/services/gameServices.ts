import { GameMode, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { Player } from "../types/player";
import { getPlayerByFullName, getPlayerById } from "./playerService";

// Temporary MVP target. Later this should come from DailyChallenge in the database.
const TARGET_PLAYER_NAME = "Dejan Kulusevski";

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

export type DailyGameState = {
  sessionId: string;
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

async function getTargetPlayer(): Promise<Player> {
  const targetPlayer = await getPlayerByFullName(TARGET_PLAYER_NAME);

  if (!targetPlayer) {
    throw new Error("Target player not found");
  }

  return targetPlayer;
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

// Legacy guess evaluator used by the current /api/game/guess route.
// It keeps the old frontend flow working while the daily-session API is being built.
export async function evaluateGuess(playerId: number): Promise<GuessResult> {
  const guessedPlayer = await getPlayerById(playerId);
  const targetPlayer = await getTargetPlayer();

  if (!guessedPlayer) {
    throw new Error("Guessed player not found");
  }

  return comparePlayers(guessedPlayer, targetPlayer);
}

async function getOrCreateDailyChallenge() {
  const today = getTodayDate();

  // Reuse today's challenge if it already exists in the database.
  const existingChallenge = await prisma.dailyChallenge.findUnique({
    where: { date: today },
  });

  if (existingChallenge) {
    return existingChallenge;
  }

  // For now the daily challenge always uses the MVP target player.
  return prisma.dailyChallenge.create({
    data: {
      date: today,
      targetPlayerName: TARGET_PLAYER_NAME,
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

export async function getDailyGameState(userId: string): Promise<DailyGameState> {
  const session = await getOrCreateDailySession(userId);
  const targetPlayer = await getTargetPlayer();

  // Guesses are stored as names, then rebuilt into full comparison results for the frontend.
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
    status: session.status,
    attempts: session.attempts,
    guesses: guessResults,
  };
}

// Main game logic for a guess.
// It loads the guessed player, loads the target player, and compares each clue field.
export async function submitDailyGuess(
  userId: string,
  playerId: number
): Promise<DailyGameState> {
  const session = await getOrCreateDailySession(userId);

  if (session.status === SessionStatus.SOLVED) {
    throw new Error("Daily challenge already solved");
  }

  const guessedPlayer = await getPlayerById(playerId);
  const targetPlayer = await getTargetPlayer();

  if (!guessedPlayer) {
    throw new Error("Spelaren du gissade på finns inte.");
  }

  // Do not allow the same player to be guessed twice in one daily session.
  const existingGuess = await prisma.guess.findFirst({
    where: {
      gameSessionId: session.id,
      guessedPlayerName: guessedPlayer.fullName,
    },
  });

  if (existingGuess) {
    throw new Error("Spelaren har redan gissats på");
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

  return getDailyGameState(userId);
}
