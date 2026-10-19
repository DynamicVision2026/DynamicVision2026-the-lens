import { type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PageViewer } from "../src/components/PageViewer";
import { unitById } from "../src/curriculum";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { mapTiles, splitTestList } from "../src/lib/review";
import { sheetData } from "../src/lib/starmap";
import { markSourceLabel, pageView, unitSheet } from "../src/lib/unitsheet";
import { Sheet } from "../src/screens/MapScreen";

const P = (n: number, unit: string, mark: SavedProblem["mark"], extra: Partial<SavedProblem> = {}): SavedProblem => ({
  n, q: `問題文 ${unit} ${n}`, unit, answer: `${n}`, mark, confidence: 0.95, reviewed: false, ...extra,
});
const page = (id: string, createdAt: string, pageType: SavedPage["pageType"], problems: SavedProblem[]): SavedPage => ({
  id, createdAt, grade: "小5", pageType, score: null, problems,
});

// 5-B1: two ✕ on an older test, then a newer test all ○ → gold (マスター).
// 5-C3: ✕ (AI), no mark at low confidence (要確認), ○ by the parent → red.
const PAGES: SavedPage[] = [
  page("a", "2026-10-01T09:00:00Z", "test", [
    P(1, "5-B1", "✕", { markSource: "teacher" }),
    P(2, "5-B1", "✕", { markSource: "ai", correctAnswer: "12cm²" }),
    P(3, "5-A1", "○", { markSource: "teacher" }),
  ]),
  page("c", "2026-10-05T09:00:00Z", "drill", [
    P(1, "5-C3", "✕", { markSource: "ai", correctAnswer: "42L" }),
    P(2, "5-C3", null, { markSource: null, confidence: 0.4 }),
    P(3, "5-C3", "○", { markSource: "parent" }),
  ]),
  page("b", "2026-10-10T09:00:00Z", "test", [
    P(1, "5-B1", "○", { markSource: "teacher" }),
    P(2, "5-B1", "○", { markSource: "parent" }),
  ]),
];

describe("unit sheet data (layer 3 record + layer 4 problems)", () => {
  it("history: every page with the unit, newest first, with ✕ / ○ for this unit only", () => {
    const { history } = unitSheet(PAGES, "5-B1");
    expect(history.map((h) => [h.pageId, h.type, h.wrong, h.ok])).toEqual([["b", "テスト", 0, 2], ["a", "テスト", 2, 0]]);
    expect(unitSheet(PAGES, "5-A2").history).toEqual([]);
  });

  it("problems: newest page first, page order within a page; every problem of the unit is listed", () => {
    const s = unitSheet(PAGES, "5-C3");
    expect(s.gold).toBe(false);
    expect(s.problems.map((p) => p.key)).toEqual(["c-0", "c-1", "c-2"]);
    expect(s.problems.map((p) => p.reason)).toEqual(["wrong", "low", null]);
    expect(s.nennotame).toEqual([]);
    expect(s.problems[0]).toMatchObject({ date: "10/5", type: "ドリル", index: 0 });
    expect(s.problems[0].page.id).toBe("c");
  });

  it("念のため: a gold unit's older ✕ sit apart, exactly as on the テスト前リスト", () => {
    const s = unitSheet(PAGES, "5-B1");
    expect(s.gold).toBe(true);
    expect(s.problems.map((p) => p.key)).toEqual(["b-0", "b-1"]); // the newest test, all ○
    expect(s.nennotame.map((p) => p.key)).toEqual(["a-0", "a-1"]);
    const list = splitTestList(PAGES, ["5-B1"]);
    expect(s.nennotame.map((p) => `${p.page.id}-${p.index}`)).toEqual(list.nennotame.map((i) => `${i.page.id}-${i.index}`));
    expect(list.main).toEqual([]);
    // a red unit: the problems with a reason are exactly the list's main items
    const red = unitSheet(PAGES, "5-C3").problems.filter((p) => p.reason);
    expect(red.map((p) => p.key)).toEqual(splitTestList(PAGES, ["5-C3"]).main.map((i) => `${i.page.id}-${i.index}`));
  });

  it("mark source labels: 先生の印 / AI判定 / 保護者; none without a mark; old pages read as the teacher's", () => {
    const s = unitSheet(PAGES, "5-B1");
    expect([...s.problems, ...s.nennotame].map((p) => p.sourceLabel)).toEqual(["先生の印", "保護者", "先生の印", "AI判定"]);
    expect(unitSheet(PAGES, "5-C3").problems.map((p) => p.sourceLabel)).toEqual(["AI判定", "", "保護者"]);
    expect(markSourceLabel({ mark: "✕" })).toBe("先生の印"); // saved before markSource existed
    expect(markSourceLabel({ mark: null, markSource: "ai" })).toBe("");
  });

  it("page viewer: every problem of the page, the open unit's highlighted", () => {
    const v = pageView(PAGES[0], "5-B1");
    expect(v).toMatchObject({ pageId: "a", date: "10/1", type: "テスト", inUnit: 2 });
    expect(v.rows.map((r) => r.inUnit)).toEqual([true, true, false]);
    expect(v.rows[1]).toMatchObject({ sourceLabel: "AI判定", correctAnswer: "12cm²", topic: unitById("5-B1")!.topic });
    expect(v.rows[2].unitLabel.startsWith("小5 ")).toBe(true);
    expect(pageView(PAGES[0], null).inUnit).toBe(0);
  });
});

const html = (el: ReactElement) => renderToStaticMarkup(createElement(MemoryRouter, null, el));
const count = (h: string, re: RegExp) => h.match(re)?.length ?? 0;
const sheetHtml = (unit: string) => {
  const data = sheetData(unit, mapTiles(PAGES))!;
  return html(
    createElement(Sheet, {
      data, record: unitSheet(PAGES, unit), grade: "小5", hidden: false,
      onClose: () => {}, onPick: () => {}, onOpenPage: () => {}, onTick: () => {}, tour: null,
    }),
  );
};

describe("unit sheet markup", () => {
  it("half height by default; record (zone, history rows that open the page) then the 問題 section", () => {
    const h = sheetHtml("5-C3");
    expect(h).toContain('data-size="half"');
    expect(h).toContain('data-testid="sheet-zone">深い森林帯<');
    expect(count(h, /data-testid="hist-row"/g)).toBe(1);
    expect(h).toContain('aria-label="10/5 ドリルのページを見る"');
    expect(h.indexOf('data-testid="sheet-history"')).toBeLessThan(h.indexOf('data-testid="sheet-problems"'));
    // 「この単元の問題を見る」 is now a button inside the sheet; the list stays one link away
    expect(h).toMatch(/<button [^>]*data-testid="sheet-to-problems"[^>]*>この単元の問題を見る/);
    expect(h).toMatch(/<a [^>]*href="\/app\/list\?unit=5-C3"[^>]*>テスト前リストで見る<\/a>/);
  });

  it("each problem: text, answer, mark + source, 正答（AI）, the tick only on list items, a page button", () => {
    const h = sheetHtml("5-C3");
    expect(count(h, /data-testid="unit-problem"/g)).toBe(3);
    expect(count(h, /data-testid="up-tick"/g)).toBe(2); // ✕ and 要確認, not the ○
    expect(h).toContain("正答（AI）：42L");
    expect(h).toContain(">要確認<");
    expect(h).toContain('data-testid="up-source">AI判定<');
    expect(h).toContain('data-testid="up-source">印なし<');
    expect(h).toContain('data-testid="up-source">保護者<');
    // no photo saved → a placeholder that still opens the page viewer
    expect(count(h, /class="thumb thumb-none"/g)).toBe(3);
    expect(h).not.toContain('data-testid="sheet-nennotame"');
  });

  it("a gold unit: its older ✕ under 「念のため」", () => {
    const h = sheetHtml("5-B1");
    const nen = h.slice(h.indexOf('data-testid="sheet-nennotame"'));
    expect(nen).toContain("念のため");
    expect(count(nen, /data-testid="unit-problem"/g)).toBe(2);
    expect(count(h, /data-testid="unit-problem"/g)).toBe(4);
  });

  it("page viewer: no photo → a note; the page's problems with this unit's marked", () => {
    const h = html(createElement(PageViewer, { page: PAGES[0], unitId: "5-B1", onClose: () => {} }));
    expect(h).toContain('aria-label="10/1 テストのページ"');
    expect(h).toContain("このページの写真は保存されていません。");
    expect(count(h, /class="pv-row is-unit"/g)).toBe(2);
    expect(count(h, /class="pv-row"/g)).toBe(1);
    expect(h).toContain('data-testid="viewer-close"');
  });
});
