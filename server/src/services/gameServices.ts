import { GameMode, SessionStatus } from "@prisma/client";
import { MAX_GUESSES } from "../constants/gameRules";
import { prisma } from "../config/prisma";
import { Player } from "../types/player";
import {
  getAllPlayers,
  getPlayerByFullName,
  getPlayerById,
} from "./playerService";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

type GameHintResult = {
  id: string;
  order: number;
  type: string;
  text: string;
};

export type GameState = {
  sessionId: string;
  mode: GameMode;
  status: SessionStatus;
  attempts: number;
  guesses: GuessResult[];
  hints: GameHintResult[];
  availableHints: number;
};

// Store daily challenges by date without a time component.
function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getLocalDateDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS
  );
}

async function getDailyTargetPlayerName(date: Date): Promise<string> {
  const players = await getAllPlayers();

  if (players.length === 0) {
    throw new Error("No players available");
  }

  const targetIndex = getLocalDateDayNumber(date) % players.length;
  return players[targetIndex].fullName;
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

function getAvailableHintCount(guessCount: number): number {
  return Math.max(0, guessCount - 2);
}

function getUniqueClubs(clubs: string[]): string[] {
  const seen = new Set<string>();

  return clubs.filter((club) => {
    const normalizedClub = normalizeClubName(club);

    if (!normalizedClub || seen.has(normalizedClub)) {
      return false;
    }

    seen.add(normalizedClub);
    return true;
  });
}

function buildPeriodHint(targetPlayer: Player, hintOrder: number) {
  if (targetPlayer.ntStartYear === null || targetPlayer.ntEndYear === null) {
    throw new Error("No national team period hint available");
  }

  return {
    type: "national_team_period",
    text: `Ledtråd ${hintOrder}: Spelaren var aktiv i landslaget under perioden ${targetPlayer.ntStartYear}–${targetPlayer.ntEndYear}.`,
  };
}

function buildClubHint(
  targetPlayer: Player,
  hintOrder: number,
  clubIndex: number,
  wording: "first" | "also" | "additional"
) {
  const club = getUniqueClubs(targetPlayer.clubsClueList)[clubIndex];

  if (!club) {
    throw new Error("No more club hints available");
  }

  if (wording === "also") {
    return {
      type: "club",
      text: `Ledtråd ${hintOrder}: Spelaren har även spelat för ${club}.`,
    };
  }

  if (wording === "additional") {
    return {
      type: "club",
      text: `Ledtråd ${hintOrder}: Spelaren har också representerat ${club}.`,
    };
  }

  return {
    type: "club",
    text: `Ledtråd ${hintOrder}: Spelaren har spelat för ${club}.`,
  };
}

function buildBirthYearHint(targetPlayer: Player, hintOrder: number) {
  if (targetPlayer.birthYear === null) {
    throw new Error("No birth year hint available");
  }

  return {
    type: "birth_year",
    text: `Ledtråd ${hintOrder}: Spelaren är född år ${targetPlayer.birthYear}.`,
  };
}

function generateHint(targetPlayer: Player, hintOrder: number) {
  if (hintOrder === 1) {
    return buildPeriodHint(targetPlayer, hintOrder);
  }

  if (hintOrder === 2) {
    return buildClubHint(targetPlayer, hintOrder, 0, "first");
  }

  if (hintOrder === 3) {
    return buildClubHint(targetPlayer, hintOrder, 1, "also");
  }

  if (hintOrder === 4) {
    return buildBirthYearHint(targetPlayer, hintOrder);
  }

  return buildClubHint(targetPlayer, hintOrder, hintOrder - 3, "additional");
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

  const hints = await prisma.gameHint.findMany({
    where: {
      gameSessionId: session.id,
    },
    orderBy: {
      hintOrder: "asc",
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
    hints: hints.map((hint) => ({
      id: hint.id,
      order: hint.hintOrder,
      type: hint.type,
      text: hint.text,
    })),
    availableHints: getAvailableHintCount(guesses.length),
  };
}

export async function requestGameHint(
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

  if (session.status !== SessionStatus.IN_PROGRESS) {
    throw new Error("Only active games can request hints");
  }

  const targetPlayer = await getPlayerByFullName(session.targetPlayerName);

  if (!targetPlayer) {
    throw new Error("Target player not found");
  }

  const [guessCount, usedHints] = await Promise.all([
    prisma.guess.count({
      where: {
        gameSessionId: session.id,
      },
    }),
    prisma.gameHint.count({
      where: {
        gameSessionId: session.id,
      },
    }),
  ]);

  const availableHints = getAvailableHintCount(guessCount);

  if (usedHints >= availableHints) {
    throw new Error("No hint is available yet");
  }

  const hintOrder = usedHints + 1;
  const hint = generateHint(targetPlayer, hintOrder);

  await prisma.gameHint.create({
    data: {
      gameSessionId: session.id,
      hintOrder,
      type: hint.type,
      text: hint.text,
    },
  });

  return buildGameState(session.id);
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

  if (session.status !== SessionStatus.IN_PROGRESS) {
    throw new Error("Game session is no longer active");
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

  if (previousGuessCount >= MAX_GUESSES) {
    throw new Error("Maximum guesses reached");
  }

  const guessOrder = previousGuessCount + 1;
  const guessResult = comparePlayers(guessedPlayer, targetPlayer);
  const nextStatus = guessResult.isCorrect
    ? SessionStatus.SOLVED
    : guessOrder >= MAX_GUESSES
      ? SessionStatus.FAILED
      : SessionStatus.IN_PROGRESS;

  // Save the guess before updating the session summary.
  await prisma.guess.create({
    data: {
      gameSessionId: session.id,
      guessedPlayerName: guessedPlayer.fullName,
      guessOrder,
    },
  });

  // Close the session on a correct guess or after the final allowed attempt.
  await prisma.gameSession.update({
    where: {
      id: session.id,
    },
    data: {
      attempts: guessOrder,
      status: nextStatus,
      completedAt: nextStatus === SessionStatus.IN_PROGRESS ? null : new Date(),
    },
  });

  return buildGameState(session.id);
}

// Daily mode
async function getOrCreateDailyChallenge() {
  const today = getTodayDate();
  const targetPlayerName = await getDailyTargetPlayerName(today);

  // Reuse today's challenge if it already exists in the database.
  const existingChallenge = await prisma.dailyChallenge.findUnique({
    where: { date: today },
  });

  if (existingChallenge) {
    // The target is derived from the date, so each calendar day gets a stable player.
    if (existingChallenge.targetPlayerName !== targetPlayerName) {
      return prisma.dailyChallenge.update({
        where: { id: existingChallenge.id },
        data: {
          targetPlayerName,
        },
      });
    }

    return existingChallenge;
  }

  // Create one shared challenge row for this date.
  return prisma.dailyChallenge.create({
    data: {
      date: today,
      targetPlayerName,
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
      return prisma.$transaction(async (tx) => {
        await tx.guess.deleteMany({
          where: {
            gameSessionId: existingSession.id,
          },
        });

        await tx.gameHint.deleteMany({
          where: {
            gameSessionId: existingSession.id,
          },
        });

        return tx.gameSession.update({
          where: { id: existingSession.id },
          data: {
            targetPlayerName: dailyChallenge.targetPlayerName,
            attempts: 0,
            completedAt: null,
          },
        });
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
