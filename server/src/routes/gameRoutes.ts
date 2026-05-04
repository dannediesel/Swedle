import express from "express";
import { evaluateGuess } from "../services/gameServices";

const router = express.Router();

// POST /api/game/guess
// Receives the guessed player id and returns feedback for each clue category.
router.post("/guess", async (req, res) => {
  try {
    const { playerId } = req.body;

    // The service expects a numeric id, so reject malformed requests early.
    if (typeof playerId !== "number") {
      return res.status(400).json({ error: "playerId must be a number" });
    }

    const result = await evaluateGuess(playerId);
    res.json(result);
  } catch (error) {
    console.error("Error evaluating guess:", error);
    res.status(500).json({ error: "Failed to evaluate guess" });
  }
});

export default router;
