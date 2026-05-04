import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";
import { Player } from "../types/player";

// Raw column names exactly as they appear in players.csv.
// This type makes the CSV-to-Player mapping explicit and easier to check.
type PlayerCsvRow = {
  full_name: string;
  birth_year: string;
  primary_position: string;
  dominant_foot: string;
  sweden_primary_shirt_number: string;
  sweden_all_shirt_numbers: string;
  clubs_clue_list: string;
  national_team_caps: string;
  national_team_goals: string;
  nt_start_year: string;
  nt_end_year: string;
};

// In development, __dirname points to src/services, so this resolves to src/data/players.csv.
const filePath = path.join(__dirname, "..", "data", "players.csv");

// Cache parsed players in memory so every search/guess does not re-read the CSV file.
// The modification time lets the cache refresh automatically if players.csv changes.
let cachedPlayers: Player[] | null = null;
let cachedPlayersMtimeMs: number | null = null;

// Convert empty CSV cells to null and valid numeric strings to numbers.
function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

// Shirt numbers are stored as pipe-separated values in the CSV, for example "7|10|11".
function parseNumberList(value: string): number[] {
  if (!value.trim()) return [];

  return value
    .split("|")
    .map((item) => Number(item.trim()))
    .filter((num) => !Number.isNaN(num));
}

// Club lists are also pipe-separated and become arrays used by the feedback logic.
function parseStringList(value: string): string[] {
  if (!value.trim()) return [];

  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Load all players from the CSV and normalize them into the Player type.
export async function getAllPlayers(): Promise<Player[]> {
  const fileStats = await fs.stat(filePath);

  if (cachedPlayers && cachedPlayersMtimeMs === fileStats.mtimeMs) {
    return cachedPlayers;
  }

  const fileContent = await fs.readFile(filePath, "utf-8");

  // csv-parse uses the first row as object keys because columns: true is enabled.
  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as PlayerCsvRow[];

  const players = rows.map((row, index) => ({
    id: index + 1,
    fullName: row.full_name.trim(),
    birthYear: toNullableNumber(row.birth_year),
    primaryPosition: row.primary_position.trim(),
    dominantFoot: row.dominant_foot.trim(),
    swedenPrimaryShirtNumber: toNullableNumber(row.sweden_primary_shirt_number),
    swedenAllShirtNumbers: parseNumberList(row.sweden_all_shirt_numbers),
    clubsClueList: parseStringList(row.clubs_clue_list),
    nationalTeamCaps: Number(row.national_team_caps),
    nationalTeamGoals: Number(row.national_team_goals),
    ntStartYear: Number(row.nt_start_year),
    ntEndYear: Number(row.nt_end_year),
  }));

  cachedPlayers = players;
  cachedPlayersMtimeMs = fileStats.mtimeMs;
  return players;
}

// Search by player name for the autocomplete input.
export async function searchPlayers(query: string): Promise<Player[]> {
  const players = await getAllPlayers();
  const normalizedQuery = query.trim().toLowerCase();

  // Empty searches should not return the entire database to the autocomplete.
  if (!normalizedQuery) {
    return [];
  }

  return players.filter((player) =>
    player.fullName.toLowerCase().includes(normalizedQuery)
  );
}

// Used by the game route when the frontend submits a guessed player id.
export async function getPlayerById(id: number): Promise<Player | undefined> {
  const players = await getAllPlayers();
  return players.find((player) => player.id === id);
}

// Used to find the current target player by name.
export async function getPlayerByFullName(fullName: string): Promise<Player | undefined> {
  const players = await getAllPlayers();
  return players.find(
    (player) => player.fullName.toLowerCase() === fullName.toLowerCase()
  );
}
