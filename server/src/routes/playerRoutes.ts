import express from "express";
import { getAllPlayers, searchPlayers } from "../services/playerService";

const router = express.Router();

// GET /api/players
// Returns every player from the CSV file. Useful for debugging and future admin views.
router.get("/", async (_req, res) => {
  try {
    const players = await getAllPlayers();
    res.json(players);
  } catch (error) {
    console.error("Error loading players:", error);
    res.status(500).json({ error: "Failed to load players" });
  }
});

// GET /api/players/search?q=<text>
// Used by the frontend autocomplete when the user starts typing a player name.
router.get("/search", async (req, res) => {
  try {
    // Query parameters can be undefined, arrays, or other shapes, so force it into a string.
    const q = String(req.query.q || "");
    const matches = await searchPlayers(q);

    // Only return a small list so the autocomplete stays readable.
    res.json(matches.slice(0, 8));
  } catch (error) {
    console.error("Error searching players:", error);
    res.status(500).json({ error: "Failed to search players" });
  }
});

export default router;
