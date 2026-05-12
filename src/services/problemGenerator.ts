import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { DailyProblemSetModel } from "../db/models/DailyProblemSet";
import type { Language, Difficulty, Problem, TestCaseInternal } from "../types";

const PROMPT_PATH = path.join(__dirname, "../prompts/generate-problem.txt");

export type GeneratedProblem = Omit<Problem, "id"> & {
  testCasesInternal: TestCaseInternal[];
};

const generatedProblemSchema = z
  .object({
    language: z.enum(["javascript", "python", "ruby"]),
    difficulty: z.enum(["beginner", "advanced"]),
    title: z.string().min(1),
    description: z.string().min(1),
    starterCode: z.string().min(1),
    testCases: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .min(3)
      .max(5),
    testCasesInternal: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          args: z.array(z.unknown()),
          expected: z.unknown(),
        })
      )
      .min(3)
      .max(5),
  })
  .refine((d) => d.testCases.length === d.testCasesInternal.length, {
    message: "testCases and testCasesInternal must have the same length",
  })
  .refine(
    (d) => d.testCases.every((tc, i) => tc.id === d.testCasesInternal[i].id),
    { message: "testCases and testCasesInternal ids must match in order" }
  );

async function getRecentTitles(): Promise<string[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceKey = since.toISOString().slice(0, 10);

  const docs = await DailyProblemSetModel.find(
    { date: { $gte: sinceKey } },
    { "problems.title": 1 }
  ).lean();

  return docs.flatMap((doc) =>
    (doc.problems as Array<{ title: string }>).map((p) => p.title)
  );
}

async function callGemini(prompt: string): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: prompt,
  });

  const result = await model.generateContent("generate");
  let text = result.response.text().trim();

  // Strip markdown fences if the model wraps the JSON despite instructions
  if (text.startsWith("```")) {
    text = text.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
  }

  return JSON.parse(text);
}

const RETRY_DELAYS_MS = [0, 2000, 4000];

export async function generateProblem(
  language: Language,
  difficulty: Difficulty
): Promise<GeneratedProblem> {
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — cannot generate problems");
  }

  const [promptTemplate, recentTitles] = await Promise.all([
    fs.promises.readFile(PROMPT_PATH, "utf-8"),
    getRecentTitles(),
  ]);

  const avoidList =
    recentTitles.length > 0
      ? recentTitles.map((t) => `- ${t}`).join("\n")
      : "(none yet)";

  const prompt = promptTemplate
    .replace(/{{LANGUAGE}}/g, language)
    .replace(/{{DIFFICULTY}}/g, difficulty)
    .replace(/{{AVOID_TITLES}}/g, avoidList);

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt])
      );
    }

    try {
      const raw = await callGemini(prompt);
      const parsed = generatedProblemSchema.parse(raw);

      if (parsed.language !== language || parsed.difficulty !== difficulty) {
        throw new Error(
          `Gemini returned wrong language/difficulty: ${parsed.language}/${parsed.difficulty}`
        );
      }

      return parsed as GeneratedProblem;
    } catch (err) {
      lastError = err;
      console.warn(
        `[problemGenerator] attempt ${attempt + 1}/3 failed (${language}/${difficulty}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  throw lastError;
}

const COMBINATIONS: [Language, Difficulty][] = [
  ["javascript", "beginner"],
  ["javascript", "advanced"],
  ["python", "beginner"],
  ["python", "advanced"],
  ["ruby", "beginner"],
  ["ruby", "advanced"],
];

const generationInProgress = new Map<string, Promise<void>>();

export function generateAndSaveProblems(date: string): Promise<void> {
  const inflight = generationInProgress.get(date);
  if (inflight) return inflight;

  const promise = _doGenerate(date).finally(() => {
    generationInProgress.delete(date);
  });
  generationInProgress.set(date, promise);
  return promise;
}

async function _doGenerate(date: string): Promise<void> {
  console.log(`[problemGenerator] generating 6 problems for ${date}...`);

  const generated = await Promise.all(
    COMBINATIONS.map(([lang, diff]) => generateProblem(lang, diff))
  );

  const problems = generated.map(({ testCasesInternal, ...rest }, i) => ({
    ...rest,
    id: `${date}_${COMBINATIONS[i][0]}_${COMBINATIONS[i][1]}`,
    testCasesInternal,
  }));

  await DailyProblemSetModel.create({ date, problems, generatedAt: new Date() });
  console.log(`[problemGenerator] saved problem set for ${date}`);
}
