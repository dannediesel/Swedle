import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// The same secret is used when creating tokens during login and verifying them here.
const JWT_SECRET = getJwtSecret();

// This is the user information we store inside the JWT when a user logs in.
export type AuthUser = {
  userId: string;
  username: string;
  role: "USER" | "ADMIN";
};

// Express does not know about req.user by default, so we extend the request type.
export type AuthenticatedRequest = Request & {
  // Populated by requireAuth after a valid JWT has been verified.
  user?: AuthUser;
};

// Read JWT_SECRET from .env once when the server starts.
// If it is missing, the backend should fail immediately instead of accepting unsafe auth.
function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined in .env");
  }

  return jwtSecret;
}

// jwt.verify can technically return any valid JSON payload.
// This checks that the decoded token actually has the shape our app expects.
function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.username === "string" &&
    (candidate.role === "USER" || candidate.role === "ADMIN")
  );
}

// Middleware for routes that require a logged-in user.
// It reads the Authorization header, verifies the JWT, and attaches the user to req.user.
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // Protected routes expect the standard format: Authorization: Bearer <token>.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  // Split "Bearer <token>" and keep only the token part.
  const token = authHeader.split(" ")[1];

  try {
    // jwt.verify throws if the token is invalid, expired, or signed with another secret.
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!isAuthUser(decoded)) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Route handlers after this middleware can now use req.user.
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
