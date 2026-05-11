import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const schema = z.object({
  MONGO_URI: z.string().default("mongodb://localhost:27017/devdle"),
  PORT: z.coerce.number().default(3001),
  GEMINI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const config = schema.parse(process.env);
