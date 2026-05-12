import { Router, Request, Response } from "express";
import { DailyProblemSetModel } from "../db/models/DailyProblemSet";
import { isValidDate, getTodayDateKey } from "../services/dateUtils";
import { generateAndSaveProblems } from "../services/problemGenerator";

const router = Router();

router.get("/:date", async (req: Request<{ date: string }>, res: Response) => {
  const { date } = req.params;

  if (!isValidDate(date)) {
    res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD." });
    return;
  }

  const today = getTodayDateKey();
  if (date > today) {
    res.status(404).json({ error: "No problems available for future dates." });
    return;
  }

  const existing = await DailyProblemSetModel
    .findOne({ date })
    .select("-problems.testCasesInternal");

  if (existing) {
    res.json({ date: existing.date, problems: existing.problems, generatedAt: existing.generatedAt });
    return;
  }

  if (date !== today) {
    res.status(404).json({ error: "No challenge for this day." });
    return;
  }

  try {
    await generateAndSaveProblems(date);
  } catch (err: unknown) {
    const isDuplicateKey =
      typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
    if (!isDuplicateKey) throw err;
  }

  const generated = await DailyProblemSetModel
    .findOne({ date })
    .select("-problems.testCasesInternal");

  if (!generated) {
    res.status(500).json({ error: "Generation failed." });
    return;
  }
  res.json({ date: generated.date, problems: generated.problems, generatedAt: generated.generatedAt });
});

export default router;
