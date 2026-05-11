import mongoose, { Schema, Document } from "mongoose";
import type { Language, Difficulty } from "../../types";

interface ProblemDoc {
  id: string;
  language: Language;
  difficulty: Difficulty;
  title: string;
  description: string;
  starterCode: string;
  testCases: { id: string; name: string }[];
  testCasesInternal: {
    id: string;
    name: string;
    args: unknown[];
    expected: unknown;
  }[];
}

export interface DailyProblemSetDoc extends Document {
  date: string;
  problems: ProblemDoc[];
  generatedAt: Date;
}

const TestCaseInternalSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    args: { type: [Schema.Types.Mixed], required: true },
    expected: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const TestCasePublicSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const ProblemSchema = new Schema(
  {
    id: { type: String, required: true },
    language: { type: String, enum: ["javascript", "python", "ruby"], required: true },
    difficulty: { type: String, enum: ["beginner", "advanced"], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    starterCode: { type: String, required: true },
    testCases: { type: [TestCasePublicSchema], required: true },
    testCasesInternal: { type: [TestCaseInternalSchema], required: true },
  },
  { _id: false }
);

const DailyProblemSetSchema = new Schema<DailyProblemSetDoc>({
  date: { type: String, required: true, unique: true },
  problems: { type: [ProblemSchema], required: true },
  generatedAt: { type: Date, required: true },
});

export const DailyProblemSetModel = mongoose.model<DailyProblemSetDoc>(
  "DailyProblemSet",
  DailyProblemSetSchema,
  "daily_problem_sets"
);
