import { describe, expect, it } from "vitest";
import { app } from "../src/copy";
import { APP_TABS, STRIP_NEXT, activeTab, buildStrip, focusFromParam, homePath, mapUnitUrl, savedToast, stripFromReport } from "../src/lib/home";
import { type SavedPage, type SavedProblem, draftFromResult, pageFromDraft } from "../src/lib/model";
import { buildReport, listUrl } from "../src/lib/report";
import { litMapUrl, mapTiles } from "../src/lib/review";
import { createReader } from "../src/reader";
import { sheetData } from "../src/lib/starmap";
import type { Mark } from "../src/reader/schema";

let seq = 0;
function page(createdAt: string, probs: [unit: string | null, mark: Mark, reviewed?: boolean][]): SavedPage {
  const problems: SavedProblem[] = probs.map(([unit, mark, reviewed], i) => ({
    n: i + 1, q: `q${i}`, unit, answer: null, mark, confidence: 0.95, reviewed: !!reviewed,
  }));
  return { id: `h${seq++}`, createdAt, grade: "小5", pageType: "test", score: null, problems };
}

const NOW = new Date("2026-10-19T05:00:00Z");
// Same shape as the screenshot seed: gold, green, red in 小5; red in 小4 (near) and 小3 (far).
const PAGES = [
  page("2026-10-01T09:00:00Z", [["5-A1", "○"], ["5-A1", "○"], ["5-A3", "✕", true], ["5-A3", "○"]]),
  page("2026-10-03T09:00:00Z", [["5-B1", "✕"], ["5-B1", "✕"], ["5-D1", null], ["5-C1", "✕"], ["5-C1", "○"]]),
  page("2026-10-10T09:00:00Z", [["5-B1", "○"], ["5-B1", "○"], ["4-A2", "✕"]]),
  page("2026-10-12T09:00:00Z", [["4-C2", "✕", true], ["3-A4", "✕"], ["6-C2", "○"]]),
  page("2026-10-18T09:00:00Z", [["5-C3", "○"], ["5-C3", "✕"], ["5-C3", "✕"]]),
];

describe("map is home", () => {
  it("/app always opens the map, also before any page is saved", () => {
    expect(homePath()).toBe("/app/map");
  });

  it("four tabs, マップ first: マップ / 撮る / テスト前 / ふりかえり (no レポート tab)", () => {
    expect(APP_TABS).toHaveLength(4);
    expect(APP_TABS[0]).toEqual({ key: "map", to: "/app/map" });
    expect(APP_TABS.map((t) => app.nav[t.key])).toEqual(["マップ", "撮る", "テスト前", "ふりかえり"]);
    expect(APP_TABS.map((t) => t.to)).toEqual(["/app/map", "/app/snap", "/app/list", "/app/archive"]);
    expect(APP_TABS.map((t) => t.to)).not.toContain("/app/report");
  });

  it("the report keeps the マップ tab lit; other routes light their own tab", () => {
    expect(activeTab("/app/report")).toBe("map");
    expect(activeTab("/app/map")).toBe("map");
    expect(activeTab("/app/list")).toBe("list");
    expect(activeTab("/app/snap")).toBe("snap");
    expect(activeTab("/app/grade")).toBeNull();
  });
});

describe("?unit= opens that unit's sheet", () => {
  it("a unit of the child's island: selected, and it has a sheet", () => {
    expect(mapUnitUrl("5-C3")).toBe("/app/map?unit=5-C3");
    const f = focusFromParam("5-C3", "小5");
    expect(f).toEqual({ selected: "5-C3" });
    const sheet = sheetData(f.selected!, mapTiles(PAGES));
    expect(sheet?.unit.topic).toBe("割合");
    expect(sheet?.tile.key).toBe("trying");
  });

  it("a unit on another island is selected too; unknown or missing → nothing selected", () => {
    expect(focusFromParam("3-A4", "小5")).toEqual({ selected: "3-A4" });
    expect(focusFromParam("x-1", "小5")).toEqual({ selected: null });
    expect(focusFromParam(null, "小5")).toEqual({ selected: null });
  });
});

describe("the map's 次にやること data = the 学習レポート's data", () => {
  it("same counts; 次にやること = the report's, topped up from its earlier-grade units; same list link", () => {
    const r = buildReport(PAGES, "小5", NOW);
    const s = buildStrip(PAGES, "小5", NOW);
    expect(s).toEqual(stripFromReport(r));
    expect(s.total).toBe(r.total);
    expect(s.counts).toEqual(r.counts);
    expect(s.counts).toEqual({ settled: 0, master: 2, reviewed: 2, trying: 2, mada: 9 });
    expect(r.next.map((n) => n.unit.id)).toEqual(["5-C3", "5-C1"]);
    expect(s.next.slice(0, r.next.length)).toEqual(r.next);
    expect(s.next.map((n) => [n.unit.id, n.wrong])).toEqual([["5-C3", 2], ["5-C1", 1], ["4-A2", 1]]);
    expect(s.next).toHaveLength(STRIP_NEXT);
    expect(s.nextList).toBe(listUrl(["5-C3", "5-C1", "4-A2"]));
  });

  it("a ✕ from an older sheet (小5 child, 小4 page) shows in 次にやること next to the grade's own", () => {
    const live = page("2026-10-19T04:00:00Z", [["4-A4", "○"], ["5-D2", "✕"], ["4-A6", "✕"], ["4-A6", "○"]]);
    const s = buildStrip([live], "小5", NOW);
    expect(s.next.map((n) => [n.unit.topic, n.wrong])).toEqual([["平均", 1], ["数量の関係を表す式", 1]]);
    expect(s.next.map((n) => n.unit.appGrade)).toEqual(["小5", "小4"]);
    expect(s.nextList).toBe("/app/list?units=5-D2,4-A6");
    expect(s.earlier).toEqual(["4-A6"]);
  });

  it("earlier-grade ✕: every red unit (not capped), nearest grade first", () => {
    const s = buildStrip(PAGES, "小5", NOW);
    expect(s.earlier).toEqual(["4-A2", "3-A4"]);
    expect(buildReport(PAGES, "小5", NOW).earlier.map((e) => e.unit.id)).toEqual(s.earlier); // ≤ 3 here
  });

  it("no pages: everything まだ, nothing to do, no list link, no earlier line", () => {
    const s = buildStrip([], "小5", NOW);
    expect(s.counts).toEqual({ settled: 0, master: 0, reviewed: 0, trying: 0, mada: 15 });
    expect(s.next).toEqual([]);
    expect(s.nextList).toBeNull();
    expect(s.earlier).toEqual([]);
  });
});

describe("toast after 保存 says what changed", () => {
  it("✕ count with their units (page order, once each), then ○", () => {
    const live = page("2026-10-19T04:00:00Z", [["4-A4", "○"], ["5-D2", "✕"], ["4-A6", "✕"], ["4-A6", "○"]]);
    expect(savedToast(live)).toBe("4問を保存しました：✕ 2問（平均、数量の関係を表す式）・○ 2問");
  });

  it("all ○, all ✕, no marks, unmarked problems, missing units, more than 3 units", () => {
    expect(savedToast(page("x", [["5-C3", "○"], ["5-C3", "○"]]))).toBe("2問を保存しました：○ 2問");
    expect(savedToast(page("x", [["5-C3", "✕"], ["5-C3", "✕"]]))).toBe("2問を保存しました：✕ 2問（割合）");
    expect(savedToast(page("x", [["5-C3", null]]))).toBe("1問を保存しました。");
    expect(savedToast(page("x", [["5-C3", "○"], ["5-D1", null]]))).toBe("2問を保存しました：○ 1問・印なし 1問");
    expect(savedToast(page("x", [[null, "✕"]]))).toBe("1問を保存しました：✕ 1問");
    expect(savedToast(page("x", [["5-C3", "✕"], ["5-D2", "✕"], ["5-A1", "✕"], ["5-B1", "✕"]]))).toBe(
      "4問を保存しました：✕ 4問（割合、平均、整数の性質 ほか）",
    );
    expect(savedToast({ problems: [] })).toBe("0問を保存しました。");
  });
});

describe("journey fixture: the founder's live 4年 sheet (mock fallback via MOCK_FALLBACK)", () => {
  it("an unmatched photo gets the MOCK_FALLBACK page; saved, it lights 4-A4 / 5-D2 / 4-A6 and the toast names the ✕ units", async () => {
    const before = process.env.MOCK_FALLBACK;
    process.env.MOCK_FALLBACK = "live4";
    try {
      const reader = createReader("mock");
      const r = await reader.read(new Uint8Array([1, 2, 3]), "image/jpeg", "小5");
      expect(r.pageType).toBe("drill");
      const d = draftFromResult(r);
      expect(d.map((p) => [p.unit, p.mark, p.markSource])).toEqual([
        ["4-A4", "○", "ai"], ["5-D2", "✕", "ai"], ["4-A6", "✕", "ai"], ["4-A6", "○", "ai"],
      ]);
      const pg = pageFromDraft(d, { grade: "小5", pageType: r.pageType, score: r.score });
      expect(litMapUrl(pg)).toBe(`/app/map?saved=4&lit=4-A4,5-D2,4-A6&page=${pg.id}`);
      expect(savedToast(pg)).toBe("4問を保存しました：✕ 2問（平均、数量の関係を表す式）・○ 2問");
    } finally {
      if (before === undefined) delete process.env.MOCK_FALLBACK;
      else process.env.MOCK_FALLBACK = before;
    }
  });
});
