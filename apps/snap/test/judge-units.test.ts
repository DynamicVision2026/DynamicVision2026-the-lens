import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRADES, readerUnitsForGrade, unitById } from "../src/curriculum";
import { parseBackup } from "../src/lib/backup";
import { UNIT_CHECK_BELOW, finalMark, markSourceOf, needsUnitCheck, withMarkSources } from "../src/lib/marks";
import { type SavedPage, draftFromResult, pageFromDraft, withParentMark } from "../src/lib/model";
import { testList } from "../src/lib/review";
import { keywordTag, loadUnitEval, summarize } from "../src/lib/unit-eval";
import { LOOKALIKES, lookalikesFor } from "../src/reader/lookalikes";
import { MockReader } from "../src/reader/mock";
import { readerPrompt, unitChoiceBlock } from "../src/reader/prompt";
import { DEFAULT_UNIT_CONFIDENCE, toPageResult } from "../src/reader/schema";

const page = (problems: Record<string, unknown>[]) => ({ page_type: "drill", problems });

describe("final mark: teacher → AI → none", () => {
  it("the teacher's red mark wins over the AI's judgment", () => {
    expect(finalMark("○", "✕")).toEqual({ mark: "○", markSource: "teacher" });
    expect(finalMark("✕", "○")).toEqual({ mark: "✕", markSource: "teacher" });
    expect(finalMark("✕", null)).toEqual({ mark: "✕", markSource: "teacher" });
  });
  it("no teacher mark → the AI's judgment; neither → null", () => {
    expect(finalMark(null, "✕")).toEqual({ mark: "✕", markSource: "ai" });
    expect(finalMark(null, "○")).toEqual({ mark: "○", markSource: "ai" });
    expect(finalMark(null, null)).toEqual({ mark: null, markSource: null });
  });
  it("confirm draft → saved page keeps the final mark, its source and the AI's answer", () => {
    const r = toPageResult(
      page([
        { q: "A", unit: "5-C3", answer: "4.2L", mark: "✕", judge: "✕", correct_answer: "42L", confidence: 0.9 },
        { q: "B", unit: "5-C2", answer: null, mark: null, judge: "✕", correct_answer: "3000人", confidence: 0.9 },
        { q: "C", unit: "5-C2", answer: "25L", mark: null, judge: null, confidence: 0.9 },
      ]),
      "小5",
    );
    const draft = draftFromResult(r);
    expect(draft.map((d) => [d.mark, d.markSource])).toEqual([["✕", "teacher"], ["✕", "ai"], [null, null]]);
    draft[2] = withParentMark(draft[2], "○");
    expect(draft[2]).toMatchObject({ mark: "○", markSource: "parent", edited: true });
    const saved = pageFromDraft(draft, { grade: "小5", pageType: "drill", score: null });
    expect(saved.problems.map((p) => p.markSource)).toEqual(["teacher", "ai", "parent"]);
    expect(saved.problems[1].correctAnswer).toBe("3000人");
    expect(saved.problems[0]).not.toHaveProperty("unitConfidence");
    expect(saved.problems[0]).not.toHaveProperty("unitAlt");
    // Downstream uses the final mark: the AI's ✕ is on the テスト前リスト like a teacher's ✕.
    expect(testList([saved], ["5-C2", "5-C3"]).map((i) => i.problem.q)).toEqual(["A", "B"]);
  });
});

describe("schema: judge, unit_confidence, unit_alt", () => {
  it("normalises judge words to ○ / ✕ / null and never touches the student's answer", () => {
    const words: [unknown, string | null][] = [
      ["正解", "○"], ["maru", "○"], ["〇", "○"], ["Correct", "○"], [true, "○"], ["まる", "○"],
      ["不正解", "✕"], ["batsu", "✕"], ["×", "✕"], ["X", "✕"], [false, "✕"], ["wrong", "✕"],
      ["✓", null], ["?", null], [null, null], [undefined, null], [{}, null],
    ];
    const r = toPageResult(page(words.map(([judge]) => ({ q: "x", unit: "5-C3", answer: "4.2L", mark: null, judge }))), "小5");
    expect(r.problems.map((p) => p.judge)).toEqual(words.map(([, w]) => w));
    expect(r.problems.every((p) => p.answer === "4.2L" && p.mark === null)).toBe(true);
  });
  it("unit_confidence: kept when 0–1, default otherwise", () => {
    const r = toPageResult(
      page([
        { q: "a", unit: "5-C3", unit_confidence: 0.55 },
        { q: "b", unit: "5-C3" },
        { q: "c", unit: "5-C3", unit_confidence: null },
        { q: "d", unit: "5-C3", unit_confidence: 85 },
        { q: "e", unit: "5-C3", unitConfidence: "0.4" },
      ]),
      "小5",
    );
    expect(r.problems.map((p) => p.unitConfidence)).toEqual([0.55, DEFAULT_UNIT_CONFIDENCE, DEFAULT_UNIT_CONFIDENCE, DEFAULT_UNIT_CONFIDENCE, 0.4]);
  });
  it("unit_alt must be in the allowed list and differ from unit", () => {
    const r = toPageResult(
      page([
        { q: "a", unit: "5-C2", unit_alt: "5-C3" },
        { q: "b", unit: "5-C2", unit_alt: "4-C2" }, // previous grade: allowed
        { q: "c", unit: "5-C2", unit_alt: "6-C2" }, // next grade: not in a 小5 list
        { q: "d", unit: "5-C2", unit_alt: "5-C2" }, // same as unit
        { q: "e", unit: "5-C2", unit_alt: "nope" },
        { q: "f", unit: "5-C2" },
        { q: "g", unit: "6-C2", unitAlt: "5-C3" }, // unit dropped, alt kept
      ]),
      "小5",
    );
    expect(r.problems.map((p) => p.unitAlt)).toEqual(["5-C3", "4-C2", null, null, null, null, "5-C3"]);
    expect(r.problems[6].unit).toBeNull();
  });
});

describe("単元を確認してください pill", () => {
  it("shows below 0.7 until the parent picks a unit", () => {
    expect(UNIT_CHECK_BELOW).toBe(0.7);
    expect(needsUnitCheck({ unitConfidence: 0.69 })).toBe(true);
    expect(needsUnitCheck({ unitConfidence: 0.7 })).toBe(false);
    expect(needsUnitCheck({ unitConfidence: 0.95 })).toBe(false);
    expect(needsUnitCheck({ unitConfidence: 0.3, unitEdited: true })).toBe(false);
    expect(needsUnitCheck({ unitConfidence: DEFAULT_UNIT_CONFIDENCE })).toBe(false); // older outputs: no pill
  });
  it("the mock p06 page has one low-confidence unit with 5-C3 as the suggestion, and AI marks", async () => {
    const reader = new MockReader(join(process.cwd(), "fixtures"), "p06");
    const r = await reader.read(new Uint8Array([1, 2, 3]), "image/jpeg", "小5");
    const d = draftFromResult(r);
    expect(d.filter((p) => needsUnitCheck(p)).map((p) => [p.n, p.unit, p.unitAlt])).toEqual([[3, "5-C2", "5-C3"]]);
    expect(d.map((p) => p.markSource)).toEqual(["ai", "ai", "ai", "ai", "ai"]);
    expect(d[4]).toMatchObject({ answer: null, mark: "✕", correctAnswer: "3000人" });
  });
});

describe("back-compat: pages and backups without markSource", () => {
  const old = (mark: "○" | "✕" | null) => ({ n: 1, q: "x", unit: "5-C3", answer: "1", mark, confidence: 0.9, reviewed: false });
  it("missing → teacher when a mark is set, else null; a stored source is kept", () => {
    expect(markSourceOf(old("○"))).toBe("teacher");
    expect(markSourceOf(old(null))).toBeNull();
    expect(markSourceOf({ ...old("✕"), markSource: "ai" })).toBe("ai");
    expect(markSourceOf({ ...old(null), markSource: "parent" })).toBe("parent");
    const pg = { id: "p", createdAt: "2026-10-01T00:00:00.000Z", grade: "小5", pageType: "test", score: null, problems: [old("✕"), old(null)] } as SavedPage;
    expect(withMarkSources(pg).problems.map((p) => p.markSource)).toEqual(["teacher", null]);
    const fresh = { ...pg, problems: [{ ...old("✕"), markSource: "ai" as const }] };
    expect(withMarkSources(fresh)).toBe(fresh); // nothing to fill → same object
  });
  it("restores a version-1 backup written before 19 Oct, and a new one with AI marks", () => {
    const file = (problems: unknown[]) =>
      JSON.stringify({ app: "lens-snap", version: 1, exportedAt: "2026-10-18T00:00:00Z", grade: "小5", pages: [{ id: "a", createdAt: "2026-10-01T00:00:00.000Z", grade: "小5", pageType: "test", score: null, problems }] });
    expect(parseBackup(file([old("✕"), old(null)]))[0].problems.map((p) => p.markSource)).toEqual(["teacher", null]);
    const back = parseBackup(file([{ ...old("✕"), markSource: "ai", correctAnswer: "42L" }]))[0].problems[0];
    expect(back).toMatchObject({ mark: "✕", markSource: "ai", correctAnswer: "42L" });
    expect(() => parseBackup(file([{ ...old("✕"), markSource: "robot" }]))).toThrow();
  });
});

describe("prompt: unit choice + judgment", () => {
  it("every look-alike id exists and each group can appear together in some grade's list", () => {
    for (const g of LOOKALIKES) {
      const ids = g.parts.map(([id]) => id);
      for (const id of ids) expect(unitById(id), id).toBeDefined();
      const usable = GRADES.some((gr) => {
        const have = new Set(readerUnitsForGrade(gr).map((u) => u.id));
        return ids.filter((id) => have.has(id)).length >= 2;
      });
      expect(usable, ids.join(",")).toBe(true);
    }
  });
  it("only shows look-alikes that are in the grade's list", () => {
    const ids = new Set(readerUnitsForGrade("小5").map((u) => u.id));
    for (const g of lookalikesFor(readerUnitsForGrade("小5"))) for (const id of g.ids) expect(ids.has(id)).toBe(true);
    // No id outside the list is mentioned anywhere in the block.
    for (const grade of GRADES) {
      const allowed = new Set(readerUnitsForGrade(grade).map((u) => u.id));
      const mentioned = unitChoiceBlock(grade).match(/\b(?:[1-6]-[A-D]\d|j[1-3]-[A-D]\d|h-[A-Z]+-\d)\b/g) ?? [];
      for (const id of mentioned) expect(allowed.has(id), `${grade}: ${id}`).toBe(true);
    }
    const b5 = unitChoiceBlock("小5");
    expect(b5).toContain("4-C2 / 5-C3:");
    expect(b5).toContain("5-C2 / 5-C3:");
    expect(b5).not.toContain("6-C2");
    expect(unitChoiceBlock("小6")).toContain("5-C3 / 6-C2:");
    expect(unitChoiceBlock("中2")).toContain("j1-C1 / j2-C1:");
    expect(unitChoiceBlock("小3")).toContain("2-C2 / 3-C2:");
  });
  it("asks for unit_confidence, unit_alt, correct_answer and judge, for photos and text", () => {
    for (const grade of GRADES) {
      const p = readerPrompt(grade);
      for (const k of ['"unit_confidence"', '"unit_alt"', '"correct_answer"', '"judge"', "Never correct the student's text", "covers"]) expect(p).toContain(k);
      expect(p).not.toContain("undefined");
      expect(p).toContain(`choose the ${grade} unit`);
    }
    expect(readerPrompt("小5", "photo")).toContain("phone photo");
    expect(readerPrompt("小5", "text")).toContain("no photo");
  });
});

describe("unit eval helpers", () => {
  it("validates the fixture: unknown ids, units outside the grade's list, duplicates", () => {
    const { items, problems } = loadUnitEval({
      problems: [
        { id: "5-C3-a", grade: "小5", unit: "5-C3", q: "定価の30%引き" },
        { id: "5-C3-a", grade: "小5", unit: "5-C3", q: "dup" },
        { id: "x-b", grade: "小5", unit: "9-Z9", q: "?" },
        { id: "y-b", grade: "小5", unit: "6-C2", q: "比" },
        { id: "z", unit: "j2-C1", kind: "b", q: "一次関数" },
      ],
    });
    expect(items.map((i) => [i.id, i.grade, i.kind])).toEqual([["5-C3-a", "小5", "a"], ["z", "中2", "b"]]);
    expect(problems).toHaveLength(3);
  });
  it("summarises accuracy, a/b, grades, misses and the most frequent wrong pairs", () => {
    const r = (id: string, truth: string, got: string | null, kind = "a", grade = "小5" as const) => ({ id, grade, kind, q: id, truth, got, alt: null, confidence: null });
    const s = summarize([r("1", "5-C3", "5-C3"), r("2", "5-C3", "4-C2", "b"), r("3", "5-C3", "4-C2", "b"), r("4", "5-C2", "5-C3"), r("5", "5-C2", null)]);
    expect([s.correct, s.total]).toEqual([1, 5]);
    expect(s.byKind).toEqual({ a: { total: 3, correct: 1 }, b: { total: 2, correct: 0 } });
    expect(s.confusion[0]).toEqual({ truth: "5-C3", got: "4-C2", count: 2 });
    expect(s.misses.map((m) => m.id)).toEqual(["2", "3", "4", "5"]);
  });
  it("the keyword baseline returns an allowed id or null", () => {
    const got = keywordTag("yはxの一次関数で、x=2のときy=1です。", "中2");
    expect(got === null || readerUnitsForGrade("中2").some((u) => u.id === got)).toBe(true);
  });
});
