import { describe, expect, it } from "vitest";
import { PageResultSchema, toPageResult } from "../src/reader/schema";
import { extractJson } from "../src/reader/claude";

const raw = {
  page_type: "test",
  grade_guess: "小5",
  score: 60,
  problems: [
    { n: 3, q: "A", unit: "5-C3", answer: "4.2L", mark: "×", confidence: 0.9 },
    { n: 1, q: "B", unit: "j1-A1", answer: null, mark: "〇", confidence: 0.8 },
    { q: "C", unit: "h-I-3", answer: "", mark: null, confidence: 2 },
  ],
  notes: "x",
};

describe("PageResult schema", () => {
  it("normalises snake_case reader output into a valid PageResult", () => {
    const r = toPageResult(raw, "小5");
    expect(PageResultSchema.safeParse(r).success).toBe(true);
    expect(r.pageType).toBe("test");
    expect(r.score).toBe("60");
    expect(r.retake).toBe(false);
    expect(r.problems.map((p) => p.n)).toEqual([1, 2, 3]); // numbered by order on the page
    expect(r.problems.map((p) => p.mark)).toEqual(["✕", "○", null]);
    expect(r.problems[2].answer).toBeNull();
    expect(r.problems[2].confidence).toBe(0.5); // out-of-range confidence falls back
  });

  it("a unit outside the grade's list becomes null", () => {
    const r = toPageResult(raw, "小5");
    expect(r.problems[0].unit).toBe("5-C3");
    expect(r.problems[1].unit).toBeNull(); // 中1 unit on a 小5 page
    expect(r.problems[2].unit).toBeNull(); // 高校 unit
    expect(toPageResult({ ...raw, problems: [{ q: "x", unit: "5-C3", mark: null, confidence: 1 }] }, "中2").problems[0].unit).toBeNull();
    expect(toPageResult({ ...raw, problems: [{ q: "x", unit: "not-a-unit", mark: null, confidence: 1 }] }, "小5").problems[0].unit).toBeNull();
  });

  it("rejects invalid shapes", () => {
    expect(PageResultSchema.safeParse({ ...toPageResult(raw, "小5"), problems: [{ n: 1, q: "x", unit: null, answer: null, mark: "?", confidence: 1 }] }).success).toBe(false);
    expect(() => toPageResult({ problems: "nope" }, "小5")).toThrow();
  });

  it("extracts JSON from fenced model output", () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a":{"b":2}}')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("sorry")).toThrow();
  });
});
