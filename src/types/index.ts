export type Language = "javascript" | "python" | "ruby";
export type Difficulty = "beginner" | "advanced";

export interface TestCaseInternal {
  id: string;
  name: string;
  args: unknown[];
  expected: unknown;
}

export interface TestCasePublic {
  id: string;
  name: string;
}

export interface Problem {
  id: string;
  language: Language;
  difficulty: Difficulty;
  title: string;
  description: string;
  starterCode: string;
  testCases: TestCasePublic[];
}

export interface DailyProblemSet {
  date: string;
  problems: Problem[];
  generatedAt: Date;
}
