import express from "express";
import {
  createChallengeForFriend,
  getFriendsDashboard,
  respondToFriendRequest,
  searchUsersForFriends,
  sendFriendRequest,
} from "../services/friendService";
import {
  AuthenticatedRequest,
  requireAuth,
} from "../auth-middleware/authMiddleware";

const router = express.Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const dashboard = await getFriendsDashboard(req.user.userId);
    return res.json(dashboard);
  } catch (error) {
    console.error("Error loading friends dashboard:", error);
    return res.status(500).json({ error: "Could not load friends" });
  }
});

router.get("/search", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const query = typeof req.query.q === "string" ? req.query.q : "";
    const users = await searchUsersForFriends(req.user.userId, query);

    return res.json(users);
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({ error: "Could not search users" });
  }
});

router.post("/requests", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { username } = req.body;

    if (typeof username !== "string" || username.trim().length === 0) {
      return res.status(400).json({ error: "username is required" });
    }

    await sendFriendRequest(req.user.userId, username.trim());
    const dashboard = await getFriendsDashboard(req.user.userId);

    return res.status(201).json(dashboard);
  } catch (error) {
    console.error("Error sending friend request:", error);
    return res.status(400).json({ error: "Could not send friend request" });
  }
});

router.post(
  "/requests/:friendshipId/respond",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { friendshipId } = req.params;
      const { action } = req.body;

      if (typeof friendshipId !== "string") {
        return res.status(400).json({ error: "friendshipId must be a string" });
      }

      if (action !== "accept" && action !== "reject") {
        return res.status(400).json({ error: "action must be accept or reject" });
      }

      await respondToFriendRequest(req.user.userId, friendshipId, action);
      const dashboard = await getFriendsDashboard(req.user.userId);

      return res.json(dashboard);
    } catch (error) {
      console.error("Error responding to friend request:", error);
      return res.status(400).json({ error: "Could not respond to friend request" });
    }
  }
);

router.post(
  "/:friendId/challenges",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { friendId } = req.params;

      if (typeof friendId !== "string") {
        return res.status(400).json({ error: "friendId must be a string" });
      }

      const challenge = await createChallengeForFriend(req.user.userId, friendId);
      return res.status(201).json(challenge);
    } catch (error) {
      console.error("Error creating friend challenge:", error);
      return res.status(400).json({ error: "Could not create challenge" });
    }
  }
);

export default router;
