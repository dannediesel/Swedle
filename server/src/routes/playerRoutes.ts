import express from "express";
import { getAllPlayers, searchPlayers } from "../services/playerService";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const players = await getAllPlayers();
    res.json(players);
  } catch (error) {
    console.error("Error loading players:", error);
    res.status(500).json({ error: "Failed to load players" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const matches = await searchPlayers(q);
    res.json(matches.slice(0, 8));
  } catch (error) {
    console.error("Error searching players:", error);
    res.status(500).json({ error: "Failed to search players" });
  }
});

export default router;