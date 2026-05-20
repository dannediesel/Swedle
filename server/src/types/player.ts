// Normalized player shape used by the backend after reading players.csv.
// The CSV stores everything as text, but the rest of the app works with these typed fields.
export type Player = {
  id: number;
  fullName: string;
  imageUrl: string | null;

  // Some historical data can be missing, so nullable fields are represented as null.
  birthYear: number | null;
  primaryPosition: string;
  dominantFoot: string;
  swedenPrimaryShirtNumber: number | null;
  swedenAllShirtNumbers: number[];
  clubsClueList: string[];
  nationalTeamCaps: number;
  nationalTeamGoals: number;
  ntStartYear: number | null;
  ntEndYear: number | null;
};
