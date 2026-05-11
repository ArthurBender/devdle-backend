import express from "express";
import { config } from "./config";
import { connectDB } from "./db/connection";
import problemsRouter from "./routes/problems";

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", db: "connected" });
});

app.use("/api/problems", problemsRouter);

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
