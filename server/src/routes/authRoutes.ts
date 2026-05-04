import express from "express";
import { prisma } from "../config/prisma";
import { registerUser, loginUser } from "../services/authService";
import { requireAuth, AuthenticatedRequest } from "../auth-middleware/authMiddleware";

const router = express.Router();

// POST /api/auth/register
// Creates a new account from username, email, and password.
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // The route handles basic request validation before calling the service layer.
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email and password are required" });
    }

    // Keep a minimum password length so users cannot register very weak passwords.
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // registerUser contains the database logic and password hashing.
    const user = await registerUser(username, email, password);

    return res.status(201).json(user);
  } catch (error) {
    console.error("Register error:", error);

    // Most register failures are user input problems, such as duplicate email/username.
    return res.status(400).json({ error: "Could not register user" });
  }
});

// POST /api/auth/login
// Checks credentials and returns a JWT token if the login is valid.
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Both fields are required because loginUser needs email lookup and password comparison.
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // loginUser returns { token, user } when the credentials are correct.
    const result = await loginUser(email, password);

    return res.json(result);
  } catch (error) {
    console.error("Login error:", error);

    // Return the same message for wrong email and wrong password.
    // This avoids revealing whether an account exists for a given email.
    return res.status(401).json({ error: "Invalid email or password" });
  }
});

// GET /api/auth/me
// Returns the currently logged-in user's profile based on the JWT token.
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // requireAuth should always attach req.user, but this keeps the route defensive.
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Fetch the latest user data from the database instead of trusting only the token payload.
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // The token can be valid even if the user was deleted after the token was issued.
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ error: "Could not fetch user" });
  }
});

export default router;
