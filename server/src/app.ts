import express from "express";
import cors from "cors";
import playerRoutes from "./routes/playerRoutes";
import gameRoutes from "./routes/gameRoutes";
import authRoutes from "./routes/authRoutes";
import statsRoutes from "./routes/statsRoute";
import friendRoutes from "./routes/friendRoutes";

// Create the Express application.
// server.ts imports this app and is responsible for starting the HTTP server.
const app = express();

// Allow the deployed frontend and local Vite dev server to call this backend.
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  })
);

// Parse incoming JSON request bodies so routes can read req.body.
app.use(express.json());

// Simple health check route used to verify that the API is running.
app.get("/", (_req, res) => {
  res.json({ message: "Swedle API is running" });
});

// Mount feature-specific routers under their API prefixes.
app.use("/api/players", playerRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/friends", friendRoutes);
export default app;
