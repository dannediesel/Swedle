import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";
import { Player } from "../types/player";

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

const filePath = path.join(__dirname, "..", "data", "players.csv");

let cachedPlayers: Player[] | null = null;
let cachedPlayersMtimeMs: number | null = null;

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

function parseNumberList(value: string): number[] {
  if (!value.trim()) return [];

  return value
    .split("|")
    .map((item) => Number(item.trim()))
    .filter((num) => !Number.isNaN(num));
}

function parseStringList(value: string): string[] {
  if (!value.trim()) return [];

  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getAllPlayers(): Promise<Player[]> {
  const fileStats = await fs.stat(filePath);

  if (cachedPlayers && cachedPlayersMtimeMs === fileStats.mtimeMs) {
    return cachedPlayers;
  }

  const fileContent = await fs.readFile(filePath, "utf-8");

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

export async function searchPlayers(query: string): Promise<Player[]> {
  const players = await getAllPlayers();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return players.filter((player) =>
    player.fullName.toLowerCase().includes(normalizedQuery)
  );
}
