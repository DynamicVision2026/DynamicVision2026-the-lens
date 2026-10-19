import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SavedPage, SavedProblem } from "../src/lib/model";

const FX = join(__dirname, "..", "fixtures");
type RP = { q: string; unit: string; answer: string | null; confidence: number; judge?: string; correct_answer?: string | null };

/**
 * The founder's three sheets for a 小5 child (same data as the 22* screenshots): the live 4年 sheet with
 * the AI's marks (○ ✕ ✕ ○), 5年 多角形と面積 (answered → ○, Q3 table and work disagree → no mark, low
 * reading confidence) and 5年 図形と割合 (answered → ○, blank → ✕), newest last.
 */
export function founderPages(): SavedPage[] {
  const live = JSON.parse(readFileSync(join(FX, "reader-outputs.json"), "utf8")).live4.problems as RP[];
  const demo = JSON.parse(readFileSync(join(FX, "exam-demo.json"), "utf8"));
  const prob = (i: number, p: RP, mark: "○" | "✕" | null, correct: string | null, conf?: number): SavedProblem => ({
    n: i + 1, q: p.q, unit: p.unit, answer: p.answer, mark, markSource: mark ? "ai" : null, correctAnswer: correct, aiJudge: mark,
    confidence: conf ?? p.confidence, reviewed: false,
  });
  const poly = demo.poly5.problems as RP[];
  const zukei = demo.zukei5.problems as RP[];
  const page = (id: string, at: string, problems: SavedProblem[]): SavedPage => ({ id, createdAt: at, grade: "小5", pageType: "drill", score: null, problems });
  return [
    page("live4", "2026-10-14T09:00:00.000Z", live.map((p, i) => prob(i, p, p.judge as "○" | "✕", p.correct_answer ?? null))),
    page("poly", "2026-10-16T09:00:00.000Z", [prob(0, poly[0], "○", "100 cm²"), prob(1, poly[1], "○", null), prob(2, poly[2], null, null, 0.55), prob(3, poly[3], "○", "2400円")]),
    page("zukei", "2026-10-18T09:00:00.000Z", [prob(0, zukei[0], "○", "120 cm²"), prob(1, zukei[1], "✕", null), prob(2, zukei[2], "✕", null), prob(3, zukei[3], "○", "600円")]),
  ];
}
/** The founder's test range: 小5 平面図形の面積 + 割合 + 平均. */
export const RANGE = ["5-B3", "5-C3", "5-D2"];
