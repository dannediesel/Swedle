import express from "express";
import { evaluateGuess } from "../services/gameServices";

const router = express.Router();

router.post("/guess", async (req, res) => {
  try {
    const { playerId } = req.body;

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