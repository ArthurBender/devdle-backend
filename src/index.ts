import express from "express";
import cors from "cors";
import cron from "node-cron";
import { config } from "./config";
import { connectDB } from "./db/connection";
import problemsRouter from "./routes/problems";
import internalRouter from "./routes/internal";
import { generateAndSaveProblems } from "./services/problemGenerator";

const app = express();

app.use(express.json());

const corsOptions: cors.CorsOptions = {
  origin: config.CORS_ORIGIN,
  methods: ["GET"],
};

app.get("/api/health", cors(corsOptions), (_req, res) => {
  res.json({ status: "ok", db: "connected" });
});

app.use("/api/problems", cors(corsOptions), problemsRouter);
app.use("/api/internal", cors(corsOptions), internalRouter);

// Pre-generate tomorrow's problems at 00:05 UTC every day
cron.schedule("5 0 * * *", async () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);
  console.log(`[cron] pre-generating problems for ${date}`);
  try {
    await generateAndSaveProblems(date);
  } catch (err) {
    console.error(`[cron] failed to generate problems for ${date}:`, err);
  }
}, { timezone: "UTC" });

async function start() {
  await connectDB();
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
