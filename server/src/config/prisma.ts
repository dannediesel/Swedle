import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// DATABASE_URL points to the PostgreSQL database from docker-compose.yml.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in .env");
}

// Prisma 7 uses a database adapter for direct PostgreSQL connections.
const adapter = new PrismaPg({ connectionString });

// Export one shared Prisma client so services can reuse the same database connection setup.
export const prisma = new PrismaClient({ adapter });
