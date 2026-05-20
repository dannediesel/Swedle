import express from "express";
import { requireAuth, AuthenticatedRequest } from "../auth-middleware/authMiddleware";
import {
  createPracticeGame,
  getDailyGameState,
  getFriendChallengeGameState,
  getPracticeGameState,
  requestGameHint,
  submitDailyGuess,
  submitFriendChallengeGuess,
  submitPracticeGuess,
} from "../services/gameServices";

const router = express.Router();

// Express can type route params as string or string[], so normalize before service calls.
function getSessionIdParam(req: AuthenticatedRequest): string | null {
  const { sessionId } = req.params;
  return typeof sessionId === "string" ? sessionId : null;
}

/* Daily mode */

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

/* Shared session actions */

// Request the next unlocked hint for any game session owned by the logged-in user.
router.post(
  "/sessions/:sessionId/hint",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const sessionId = getSessionIdParam(req);

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId must be a string" });
      }

      const gameState = await requestGameHint(req.user.userId, sessionId);
      return res.json(gameState);
    } catch (error) {
      console.error("Error requesting hint:", error);
      return res.status(400).json({ error: "Failed to request hint" });
    }
  }
);

/* Practice mode */

// Start a new practice game with a random target player.
router.post("/practice/new", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const gameState = await createPracticeGame(req.user.userId);
    return res.status(201).json(gameState);
  } catch (error) {
    console.error("Error creating practice game:", error);
    return res.status(500).json({ error: "Failed to create practice game" });
  }
});

// Load one existing practice game by session id.
router.get(
  "/practice/:sessionId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const sessionId = getSessionIdParam(req);

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId must be a string" });
      }

      const gameState = await getPracticeGameState(
        req.user.userId,
        sessionId
      );

      return res.json(gameState);
    } catch (error) {
      console.error("Error loading practice game:", error);
      return res.status(404).json({ error: "Failed to load practice game" });
    }
  }
);

// Submit a guess to an existing practice game.
router.post(
  "/practice/:sessionId/guess",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { playerId } = req.body;
      const sessionId = getSessionIdParam(req);

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId must be a string" });
      }

      if (typeof playerId !== "number") {
        return res.status(400).json({ error: "playerId must be a number" });
      }

      const gameState = await submitPracticeGuess(
        req.user.userId,
        sessionId,
        playerId
      );

      return res.json(gameState);
    } catch (error) {
      console.error("Error submitting practice guess:", error);
      return res.status(400).json({ error: "Failed to submit practice guess" });
    }
  }
);

/* Friend challenge mode */

router.get(
  "/friend-challenges/:sessionId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const sessionId = getSessionIdParam(req);

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId must be a string" });
      }

      const gameState = await getFriendChallengeGameState(
        req.user.userId,
        sessionId
      );

      return res.json(gameState);
    } catch (error) {
      console.error("Error loading friend challenge:", error);
      return res.status(404).json({ error: "Failed to load friend challenge" });
    }
  }
);

router.post(
  "/friend-challenges/:sessionId/guess",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { playerId } = req.body;
      const sessionId = getSessionIdParam(req);

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId must be a string" });
      }

      if (typeof playerId !== "number") {
        return res.status(400).json({ error: "playerId must be a number" });
      }

      const gameState = await submitFriendChallengeGuess(
        req.user.userId,
        sessionId,
        playerId
      );

      return res.json(gameState);
    } catch (error) {
      console.error("Error submitting friend challenge guess:", error);
      return res.status(400).json({ error: "Failed to submit friend challenge guess" });
    }
  }
);

export default router;
