import { describe, expect, it } from "vitest";
import { GRADES, UNITS } from "../src/curriculum";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { litMapUrl, mapSections, mapTiles, pageUnitIds, parseLit } from "../src/lib/review";
import type { Mark } from "../src/reader/schema";

let seq = 0;
function page(createdAt: string, probs: [unit: string | null, mark: Mark, reviewed?: boolean][]): SavedPage {
  const problems: SavedProblem[] = probs.map(([unit, mark, reviewed], i) => ({
    n: i + 1, q: `q${i}`, unit, answer: null, mark, confidence: 0.95, reviewed: !!reviewed,
  }));
  return { id: `p${seq++}`, createdAt, grade: "小5", pageType: "test", score: null, problems };
}
const status = (pages: SavedPage[], id: string) => mapTiles(pages).find((t) => t.unit.id === id)!.status;

describe("map tile status (gold → review → ok → empty)", () => {
  it("empty when there are no problems", () => {
    expect(status([], "5-C3")).toBe("empty");
    expect(status([page("2026-10-01T00:00:00Z", [["5-A3", "✕"]])], "5-C3")).toBe("empty");
  });

  it("review when a ✕ is not yet ticked 「復習した」", () => {
    expect(status([page("2026-10-01T00:00:00Z", [["5-C3", "○"], ["5-C3", "✕"]])], "5-C3")).toBe("review");
  });

  it("ok when every ✕ is reviewed (and not gold: the newest page had a ✕)", () => {
    expect(status([page("2026-10-01T00:00:00Z", [["5-C3", "○"], ["5-C3", "✕", true]])], "5-C3")).toBe("ok");
  });

  it("ok for data without marks; reviewing never makes a tile gold", () => {
    expect(status([page("2026-10-01T00:00:00Z", [["5-C3", null], ["5-C3", null]])], "5-C3")).toBe("ok");
    expect(status([page("2026-10-01T00:00:00Z", [["5-C3", "✕", true]])], "5-C3")).toBe("ok");
  });

  it("gold when the newest page with this unit has only ○ for it", () => {
    expect(status([page("2026-10-01T00:00:00Z", [["5-C3", "○"], ["5-C3", "○"], ["5-A3", "✕"]])], "5-C3")).toBe("gold");
  });

  it("a later all-○ page after an earlier ✕ → gold, even with the old ✕ unreviewed", () => {
    const pages = [
      page("2026-10-01T00:00:00Z", [["5-C3", "✕"], ["5-C3", "✕"]]),
      page("2026-10-08T00:00:00Z", [["5-C3", "○"], ["5-C3", "○"]]),
    ];
    expect(status(pages, "5-C3")).toBe("gold");
    expect(status([...pages].reverse(), "5-C3")).toBe("gold"); // order in the array does not matter
  });

  it("null marks on the newest page are not gold", () => {
    const pages = [page("2026-10-08T00:00:00Z", [["5-C3", "○"], ["5-C3", null]])];
    expect(status(pages, "5-C3")).toBe("ok");
  });

  it("newest page with a ✕ → review, even after an earlier all-○ page", () => {
    const pages = [
      page("2026-10-01T00:00:00Z", [["5-C3", "○"]]),
      page("2026-10-08T00:00:00Z", [["5-C3", "○"], ["5-C3", "✕"]]),
    ];
    expect(status(pages, "5-C3")).toBe("review");
  });

  it("a newer page without this unit does not change it", () => {
    const pages = [
      page("2026-10-01T00:00:00Z", [["5-C3", "○"]]),
      page("2026-10-08T00:00:00Z", [["5-A3", "✕"], [null, "✕"]]),
    ];
    expect(status(pages, "5-C3")).toBe("gold");
    expect(status(pages, "5-A3")).toBe("review");
  });
});

describe("whole-curriculum map", () => {
  it("covers exactly the 110 units, each once, grouped by grade", () => {
    const secs = mapSections([], "小5");
    const ids = secs.flatMap((s) => s.tiles.map((t) => t.unit.id));
    expect(ids).toHaveLength(110);
    expect(new Set(ids).size).toBe(110);
    expect(new Set(ids)).toEqual(new Set(UNITS.map((u) => u.id)));
    expect(secs.map((s) => s.grade).sort()).toEqual([...GRADES].sort());
    for (const s of secs) expect(s.tiles.every((t) => t.unit.appGrade === s.grade)).toBe(true);
  });

  it("puts the child's own grade first, then 小1 … 高3 in order", () => {
    const secs = mapSections([], "中1");
    expect(secs[0]).toMatchObject({ grade: "中1", own: true });
    expect(secs.slice(1).map((s) => s.grade)).toEqual(GRADES.filter((g) => g !== "中1"));
    expect(secs.filter((s) => s.own)).toHaveLength(1);
  });

  it("section counts summarise the tiles", () => {
    const pages = [page("2026-10-01T00:00:00Z", [["5-C3", "✕"], ["5-A3", "○"], ["6-A1", null], ["5-B1", "✕", true]])];
    const [own] = mapSections(pages, "小5");
    expect(own.counts).toMatchObject({ review: 1, gold: 1, ok: 1 });
    expect(own.counts.empty).toBe(own.tiles.length - 3);
    expect(mapSections(pages, "小5").find((s) => s.grade === "小6")!.counts.ok).toBe(1);
  });
});

describe("light up after 保存", () => {
  it("parses ?lit= into known unit ids, de-duplicated, in order", () => {
    expect(parseLit("5-C3,5-B3")).toEqual(["5-C3", "5-B3"]);
    expect(parseLit(" 5-C3 , ,5-C3,nope,h-I-3")).toEqual(["5-C3", "h-I-3"]);
    expect(parseLit("")).toEqual([]);
    expect(parseLit(null)).toEqual([]);
    expect(parseLit("<script>")).toEqual([]);
  });

  it("builds the map URL from the saved page's units", () => {
    const pg = page("2026-10-01T00:00:00Z", [["5-C3", "✕"], [null, "○"], ["5-B3", "○"], ["5-C3", "○"]]);
    expect(pageUnitIds(pg)).toEqual(["5-C3", "5-B3"]);
    const url = litMapUrl(pg);
    expect(url).toBe(`/app/map?saved=4&lit=5-C3,5-B3&page=${pg.id}`);
    expect(parseLit(new URL(url, "http://x").searchParams.get("lit"))).toEqual(["5-C3", "5-B3"]);
    const bare = page("2026-10-01T00:00:00Z", [[null, "✕"]]);
    expect(litMapUrl(bare)).toBe(`/app/map?saved=1&page=${bare.id}`);
  });
});
