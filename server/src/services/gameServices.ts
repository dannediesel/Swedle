import { Player } from "../types/player";
import { getPlayerByFullName, getPlayerById } from "./playerService";

// Temporary MVP target. Later this should come from DailyChallenge in the database.
const TARGET_PLAYER_NAME = "John Guidetti";

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

// Club feedback is partial when the guessed player and target player share at least one club.
function compareClubLists(guessedClubs: string[], targetClubs: string[]): ComparisonStatus {
  const guessedSet = new Set(
    guessedClubs.map(normalizeClubName).filter((club) => club.length > 0)
  );
  const hasMatch = targetClubs
    .map(normalizeClubName)
    .some((club) => club.length > 0 && guessedSet.has(club));

  return hasMatch ? "partial" : "incorrect";
}

// Main game logic for a guess.
// It loads the guessed player, loads the target player, and compares each clue field.
export async function evaluateGuess(playerId: number): Promise<GuessResult> {
  const guessedPlayer = await getPlayerById(playerId);
  const targetPlayer = await getPlayerByFullName(TARGET_PLAYER_NAME);

  if (!guessedPlayer) {
    throw new Error("Guessed player not found");
  }

  if (!targetPlayer) {
    throw new Error("Target player not found");
  }

  return {
    guessedPlayer,
    isCorrect: guessedPlayer.id === targetPlayer.id,
    comparisons: {
      fullName: guessedPlayer.id === targetPlayer.id ? "correct" : "incorrect",
      primaryPosition: compareText(guessedPlayer.primaryPosition, targetPlayer.primaryPosition),
      dominantFoot: compareText(guessedPlayer.dominantFoot, targetPlayer.dominantFoot),
      swedenPrimaryShirtNumber: compareNullableNumber(
        guessedPlayer.swedenPrimaryShirtNumber,
        targetPlayer.swedenPrimaryShirtNumber
      ),
      clubs:
        guessedPlayer.id === targetPlayer.id
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
