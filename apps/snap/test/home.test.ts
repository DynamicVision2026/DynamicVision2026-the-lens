import { describe, expect, it } from "vitest";
import { app } from "../src/copy";
import { APP_TABS, activeTab, buildStrip, earlierBand, focusFromParam, homePath, mapUnitUrl, stripFromReport } from "../src/lib/home";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { buildReport, listUrl } from "../src/lib/report";
import { mapTiles } from "../src/lib/review";
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
  it("/app opens the map once there are pages, 撮る before that", () => {
    expect(homePath(0)).toBe("/app/snap");
    expect(homePath(1)).toBe("/app/map");
    expect(homePath(PAGES.length)).toBe("/app/map");
  });

  it("four tabs: 撮る / マップ / テスト前 / ふりかえり (no レポート tab)", () => {
    expect(APP_TABS).toHaveLength(4);
    expect(APP_TABS.map((t) => app.nav[t.key])).toEqual(["撮る", "マップ", "テスト前", "ふりかえり"]);
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

describe("?unit= opens that star's sheet", () => {
  it("a near unit: selected, no band to open, and it has a sheet", () => {
    expect(mapUnitUrl("5-C3")).toBe("/app/map?unit=5-C3");
    const f = focusFromParam("5-C3", "小5");
    expect(f).toEqual({ selected: "5-C3", opened: null });
    const sheet = sheetData(f.selected!, mapTiles(PAGES));
    expect(sheet?.unit.topic).toBe("割合");
    expect(sheet?.tile.status).toBe("review");
  });

  it("a far unit opens its band; unknown or missing → nothing selected", () => {
    expect(focusFromParam("3-A4", "小5")).toEqual({ selected: "3-A4", opened: "小3" });
    expect(focusFromParam("4-A2", "小5")).toEqual({ selected: "4-A2", opened: null }); // grade below is near
    expect(focusFromParam("x-1", "小5")).toEqual({ selected: null, opened: null });
    expect(focusFromParam(null, "小5")).toEqual({ selected: null, opened: null });
  });
});

describe("report strip on the map = the 学習レポート's data", () => {
  it("same counts, same 次にやること, same list link", () => {
    const r = buildReport(PAGES, "小5", NOW);
    const s = buildStrip(PAGES, "小5", NOW);
    expect(s).toEqual(stripFromReport(r));
    expect(s.total).toBe(r.total);
    expect(s.counts).toEqual(r.counts);
    expect(s.counts).toEqual({ gold: 2, ok: 2, review: 2, empty: 9 });
    expect(s.next).toEqual(r.next);
    expect(s.next.map((n) => [n.unit.id, n.wrong])).toEqual([["5-C3", 2], ["5-C1", 1]]);
    expect(s.nextList).toBe(listUrl(["5-C3", "5-C1"]));
  });

  it("earlier-grade ✕: every red unit (not capped), nearest grade first; the far one's band opens", () => {
    const s = buildStrip(PAGES, "小5", NOW);
    expect(s.earlier).toEqual(["4-A2", "3-A4"]);
    expect(buildReport(PAGES, "小5", NOW).earlier.map((e) => e.unit.id)).toEqual(s.earlier); // ≤ 3 here
    expect(earlierBand(s.earlier, "小5")).toBe("小3");
    expect(earlierBand(["4-A2"], "小5")).toBeNull();
  });

  it("no pages: everything まだ, nothing to do, no list link, no earlier line", () => {
    const s = buildStrip([], "小5", NOW);
    expect(s.counts).toEqual({ gold: 0, ok: 0, review: 0, empty: 15 });
    expect(s.next).toEqual([]);
    expect(s.nextList).toBeNull();
    expect(s.earlier).toEqual([]);
  });
});
