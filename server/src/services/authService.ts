import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

// Used to sign login tokens. The middleware must use the same secret to verify them.
const JWT_SECRET = getJwtSecret();

// Read JWT_SECRET from .env once when this module loads.
// Without it, login cannot create trusted tokens.
function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined in .env");
  }

  return jwtSecret;
}

// Creates a new user account.
// The function checks duplicates, hashes the password, and stores the user in PostgreSQL.
export async function registerUser(username: string, email: string, password: string) {
  // Usernames and emails must stay unique so login and profiles remain unambiguous.
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    throw new Error("User with this email or username already exists");
  }

  // Store only the password hash, never the plain text password.
  // The number 10 is bcrypt's salt rounds: higher is slower but harder to brute-force.
  const passwordHash = await bcrypt.hash(password, 10);

  // Select only the fields that should be returned from registration.
  // passwordHash is deliberately left out.
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

// Logs in an existing user.
// If the credentials are correct, it returns both a JWT and basic user information.
export async function loginUser(email: string, password: string) {
  // First find the user by email so we can access the stored password hash.
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Use the same error for missing user and wrong password.
  // That way the API does not reveal whether an email exists.
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Compare the submitted password against the stored bcrypt hash.
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("Invalid email or password");
  }

  // The token contains only the identity data the API needs on protected routes.
  // expiresIn: "7d" means the user stays logged in for seven days unless the token is removed.
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  // The frontend stores the token and can send it with future protected requests.
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  };
}
