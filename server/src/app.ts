import express from "express";
import cors from "cors";
import playerRoutes from "./routes/playerRoutes";
import gameRoutes from "./routes/gameRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Swedle API is running" });
});

app.use("/api/players", playerRoutes);
app.use("/api/game", gameRoutes);

export default app;