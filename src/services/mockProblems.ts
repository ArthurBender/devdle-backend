import type { Problem } from "../types";

export const MOCK_PROBLEMS: Omit<Problem, "id">[] = [
  {
    language: "javascript",
    difficulty: "beginner",
    title: "Sum numeric values",
    description: "Return the sum of all numeric values in a mixed array.",
    starterCode: "function solve(items) {\n  // your code here\n  return 0;\n}",
    testCases: [
      { id: "tc_0", name: "handles empty array" },
      { id: "tc_1", name: "mixed numbers and strings" },
      { id: "tc_2", name: "ignores null and undefined" },
    ],
  },
  {
    language: "javascript",
    difficulty: "advanced",
    title: "Implement debounce",
    description: "Implement a debounce function with leading and trailing edge support.",
    starterCode: "function solve(fn, wait, options = {}) {\n  // your code here\n}",
    testCases: [
      { id: "tc_0", name: "delays execution" },
      { id: "tc_1", name: "leading edge fires immediately" },
      { id: "tc_2", name: "trailing edge fires after wait" },
    ],
  },
  {
    language: "python",
    difficulty: "beginner",
    title: "Count vowels",
    description: "Count vowels in a string, case-insensitive.",
    starterCode: "def solve(s):\n    # your code here\n    return 0",
    testCases: [
      { id: "tc_0", name: "empty string" },
      { id: "tc_1", name: "all vowels" },
      { id: "tc_2", name: "mixed case" },
    ],
  },
  {
    language: "python",
    difficulty: "advanced",
    title: "Merge overlapping intervals",
    description: "Merge overlapping intervals and return them sorted.",
    starterCode: "def solve(intervals):\n    # your code here\n    return []",
    testCases: [
      { id: "tc_0", name: "no overlap" },
      { id: "tc_1", name: "all overlap" },
      { id: "tc_2", name: "partial overlap" },
    ],
  },
  {
    language: "ruby",
    difficulty: "beginner",
    title: "Reverse words",
    description: "Reverse the words but keep the order.",
    starterCode: "def solve(s)\n  # your code here\nend",
    testCases: [
      { id: "tc_0", name: "single word" },
      { id: "tc_1", name: "multiple words" },
      { id: "tc_2", name: "empty string" },
    ],
  },
  {
    language: "ruby",
    difficulty: "advanced",
    title: "Group anagrams",
    description: "Group anagrams from a list of words.",
    starterCode: "def solve(words)\n  # your code here\nend",
    testCases: [
      { id: "tc_0", name: "no anagrams" },
      { id: "tc_1", name: "all same anagram" },
      { id: "tc_2", name: "mixed groups" },
    ],
  },
];
