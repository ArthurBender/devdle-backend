import { Router, Request, Response } from "express";
import { DailyProblemSetModel } from "../db/models/DailyProblemSet";

const router = Router();

// No CORS headers on this router — browsers block cross-origin requests by default,
// which is what we want: only in-browser workers on the same origin can call this.
router.get("/testcases/:problemId", async (req: Request<{ problemId: string }>, res: Response) => {
  const { problemId } = req.params;

  // problemId format: "YYYY-MM-DD_language_difficulty"
  const date = problemId.slice(0, 10);

  const doc = await DailyProblemSetModel.findOne({ date }).lean();
  if (!doc) {
    res.status(404).json({ error: "Problem set not found." });
    return;
  }

  const problem = (doc.problems as Array<{ id: string; testCasesInternal: unknown }>)
    .find((p) => p.id === problemId);

  if (!problem) {
    res.status(404).json({ error: "Problem not found." });
    return;
  }

  res.json({ testCasesInternal: problem.testCasesInternal });
});

export default router;
