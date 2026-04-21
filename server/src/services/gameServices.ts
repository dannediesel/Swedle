import { Player } from "../types/player";
import { getPlayerByFullName, getPlayerById } from "./playerService";

const TARGET_PLAYER_NAME = "Albin Ekdal";

type ComparisonStatus = "correct" | "incorrect" | "higher" | "lower" | "partial";

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

function compareText(guessed: string, target: string): ComparisonStatus {
  return guessed === target ? "correct" : "incorrect";
}

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

function compareClubLists(guessedClubs: string[], targetClubs: string[]): ComparisonStatus {
  const guessedSet = new Set(guessedClubs.map((club) => club.toLowerCase()));
  const hasMatch = targetClubs.some((club) => guessedSet.has(club.toLowerCase()));

  return hasMatch ? "partial" : "incorrect";
}

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