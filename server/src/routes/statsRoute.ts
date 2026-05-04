import express from "express";
import { requireAuth, AuthenticatedRequest } from "../auth-middleware/authMiddleware";
import { getStatsForUser } from "../services/statsService";

const router = express.Router();

// Return statistics for the currently logged-in user.
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // requireAuth normally sets req.user; this keeps the route safe if it is missing.
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const stats = await getStatsForUser(req.user.userId);
    return res.json(stats);
  } catch (error) {
    console.error("Error loading user stats:", error);
    return res.status(500).json({ error: "Failed to load user stats" });
  }
});

export default router;
