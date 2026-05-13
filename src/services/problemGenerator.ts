import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { DailyProblemSetModel } from "../db/models/DailyProblemSet";
import type { Language, Difficulty, Problem, TestCaseInternal } from "../types";

const PROMPT_PATH = path.join(__dirname, "../prompts/generate-problem.txt");
const VALIDATE_PROMPT_PATH = path.join(__dirname, "../prompts/validate-problems.txt");

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

const validationResultSchema = z.discriminatedUnion("valid", [
  z.object({ index: z.number(), valid: z.literal(true) }),
  z.object({
    index: z.number(),
    valid: z.literal(false),
    correctedTestCases: z.object({
      testCases: z.array(z.object({ id: z.string(), name: z.string() })),
      testCasesInternal: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          args: z.array(z.unknown()),
          expected: z.unknown(),
        })
      ),
    }),
  }),
]);
const validationResponseSchema = z.array(validationResultSchema);

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

async function callGemini(systemPrompt: string, userContent = "generate"): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userContent);
  let text = result.response.text().trim();

  // Strip markdown fences if the model wraps the JSON despite instructions
  if (text.startsWith("```")) {
    text = text.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
  }

  return JSON.parse(text);
}

function getRetryDelayMs(err: unknown, attempt: number): number {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.includes("Too Many Requests")) {
    return attempt === 1 ? 60_000 : 120_000; // 1 min, 2 min
  }
  if (msg.includes("503") || msg.includes("Service Unavailable")) {
    return attempt === 1 ? 10_000 : 20_000; // 10s, 20s
  }
  return attempt === 1 ? 2_000 : 4_000; // fallback: 2s, 4s
}

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

  const raw = await callGemini(prompt);
  const parsed = generatedProblemSchema.parse(raw);

  if (parsed.language !== language || parsed.difficulty !== difficulty) {
    throw new Error(
      `Gemini returned wrong language/difficulty: ${parsed.language}/${parsed.difficulty}`
    );
  }

  return parsed as GeneratedProblem;
}

async function validateAndCorrectProblems(
  problems: GeneratedProblem[]
): Promise<GeneratedProblem[]> {
  const systemPrompt = await fs.promises.readFile(VALIDATE_PROMPT_PATH, "utf-8");
  const userContent = JSON.stringify(
    problems.map(({ language, difficulty, title, description, starterCode, testCases, testCasesInternal }) => ({
      language,
      difficulty,
      title,
      description,
      starterCode,
      testCases,
      testCasesInternal,
    }))
  );

  const raw = await callGemini(systemPrompt, userContent);
  const results = validationResponseSchema.parse(raw);

  const corrected = [...problems];
  for (const result of results) {
    if (!result.valid) {
      console.warn(
        `[problemGenerator] validation corrected test cases for: "${problems[result.index].title}"`
      );
      corrected[result.index] = {
        ...corrected[result.index],
        testCases: result.correctedTestCases.testCases,
        testCasesInternal: result.correctedTestCases.testCasesInternal,
      };
    }
  }
  return corrected;
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

  const generated: GeneratedProblem[] = [];
  for (const [lang, diff] of COMBINATIONS) {
    let lastError: unknown;
    let problem: GeneratedProblem | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = getRetryDelayMs(lastError, attempt);
        console.warn(
          `[problemGenerator] waiting ${delay / 1000}s before retry ${attempt + 1}/3 (${lang}/${diff})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        console.log(`[problemGenerator] generating ${lang}/${diff} (attempt ${attempt + 1}/3)...`);
        problem = await generateProblem(lang, diff);
        break;
      } catch (err) {
        lastError = err;
        console.warn(
          `[problemGenerator] attempt ${attempt + 1}/3 failed (${lang}/${diff}):`,
          err instanceof Error ? err.message : err
        );
      }
    }

    if (!problem) throw lastError;
    generated.push(problem);
  }

  let validated = generated;
  try {
    console.log(`[problemGenerator] validating test cases for ${date}...`);
    validated = await validateAndCorrectProblems(generated);
  } catch (err) {
    console.warn(
      `[problemGenerator] test case validation failed, saving unvalidated problems:`,
      err instanceof Error ? err.message : err
    );
  }

  const problems = validated.map(({ testCasesInternal, ...rest }, i) => ({
    ...rest,
    id: `${date}_${COMBINATIONS[i][0]}_${COMBINATIONS[i][1]}`,
    testCasesInternal,
  }));

  await DailyProblemSetModel.create({ date, problems, generatedAt: new Date() });
  console.log(`[problemGenerator] saved problem set for ${date}`);
}
