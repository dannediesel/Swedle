import express from "express";
import { requireAuth, AuthenticatedRequest } from "../auth-middleware/authMiddleware";
import { getDailyGameState, submitDailyGuess } from "../services/gameServices";

const router = express.Router();

// Load the saved daily game for the logged-in user.
router.get("/daily", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // requireAuth should set req.user, but this keeps the route safe if it ever does not.
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const gameState = await getDailyGameState(req.user.userId);
    return res.json(gameState);
  } catch (error) {
    console.error("Error loading daily game:", error);
    return res.status(500).json({ error: "Failed to load daily game" });
  }
});

// Submit one daily guess and return the updated game state.
router.post("/daily/guess", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Only authenticated users can create guesses tied to a daily session.
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { playerId } = req.body;

    // The frontend sends the selected player's database id.
    if (typeof playerId !== "number") {
      return res.status(400).json({ error: "playerId must be a number" });
    }

    const gameState = await submitDailyGuess(req.user.userId, playerId);
    return res.json(gameState);
  } catch (error) {
    console.error("Error submitting daily guess:", error);
    return res.status(400).json({ error: "Failed to submit guess" });
  }
});

export default router;
