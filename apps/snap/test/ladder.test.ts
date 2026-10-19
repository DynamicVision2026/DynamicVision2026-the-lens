import { type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TerrGlyph } from "../src/components/TerrGlyph";
import { TerritoryMap } from "../src/components/TerritoryMap";
import { YOUTUBE_CHANNEL_URL, app } from "../src/copy";
import { buildPlan } from "../src/lib/examplan";
import { RETENTION_DAYS, calendarDays, countsLine, nextStepLine, unitLevel, unitLevels, zeroCounts } from "../src/lib/ladder";
import type { MarkSource } from "../src/lib/marks";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { buildReport } from "../src/lib/report";
import { LEGACY_LEVEL, goldUnits, legacyStatus, mapTiles, splitTestList } from "../src/lib/review";
import { sheetData } from "../src/lib/starmap";
import { buildHud, tileLabel } from "../src/lib/territory";
import { unitSheet } from "../src/lib/unitsheet";
import { channelUrl, unitVideoUrl } from "../src/lib/youtube";
import { yearlyRecord } from "../src/lib/yearly";
import type { Mark } from "../src/reader/schema";
import { PlanSheet } from "../src/screens/ExamMode";
import { Sheet } from "../src/screens/MapScreen";
import { RANGE, founderPages } from "./founder-pages";

type P = [unit: string | null, mark: Mark, opts?: { reviewed?: boolean; source?: MarkSource }];
let seq = 0;
/** A page on a local calendar day (noon, device time). */
function page(day: string, probs: P[], time = "12:00:00"): SavedPage {
  const problems: SavedProblem[] = probs.map(([unit, mark, o], i) => ({
    n: i + 1, q: `q${i}`, unit, answer: null, mark, confidence: 0.95, reviewed: !!o?.reviewed, ...(o?.source ? { markSource: o.source } : {}),
  }));
  return { id: `L${seq++}`, createdAt: new Date(`${day}T${time}`).toISOString(), grade: "小5", pageType: "test", score: null, problems };
}
const NOW = new Date(2026, 9, 19, 20, 0); // Mon 19 Oct 2026, evening
const lv = (pages: SavedPage[], id = "5-C3", now = NOW) => unitLevel(pages, id, now);
const html = (el: ReactElement) => renderToStaticMarkup(createElement(MemoryRouter, null, el));
const U = "5-C3";

describe("5-step ladder: each step", () => {
  it("Lv0 まだ: no problems in this unit (other units do not count)", () => {
    expect(lv([])).toMatchObject({ level: 0, key: "mada", name: "まだ" });
    expect(lv([page("2026-10-10", [["5-A1", "✕"]])])).toMatchObject({ level: 0 });
  });
  it("Lv1 挑戦中: a ✕ not yet ticked 「復習した」", () => {
    const u = lv([page("2026-10-10", [[U, "○"], [U, "✕"]])]);
    expect(u).toMatchObject({ level: 1, key: "trying", name: "挑戦中" });
    expect(u.reasons).toMatchObject({ count: 2, wrong: 1, pending: 1, latestAllOk: false, masteredAt: null, settleDay: null });
  });
  it("Lv2 復習ずみ: data, every ✕ reviewed, newest page not all ○ (also: only unmarked problems)", () => {
    expect(lv([page("2026-10-10", [[U, "○"], [U, "✕", { reviewed: true }]])])).toMatchObject({ level: 2, key: "reviewed", name: "復習ずみ" });
    expect(lv([page("2026-10-10", [[U, null], [U, null]])])).toMatchObject({ level: 2 });
  });
  it("Lv3 マスター: the newest page with this unit has ≥ 1 problem there, all ○", () => {
    const u = lv([page("2026-10-01", [[U, "✕"]]), page("2026-10-10", [[U, "○"], [U, "○"], ["5-A1", "✕"]])]);
    expect(u).toMatchObject({ level: 3, key: "master", name: "マスター" });
    expect(u.reasons.settleDay).toBe("2026-10-24");
    expect(u.reasons.daysLeft).toBe(5);
  });
  it("Lv4 定着: マスター, and an earlier all-○ page ≥ 14 days before, no ✕ page in between", () => {
    const u = lv([page("2026-10-01", [[U, "○"]]), page("2026-10-15", [[U, "○"], [U, "○"]])]);
    expect(u).toMatchObject({ level: 4, key: "settled", name: "定着" });
    expect(u.reasons.masteredAt).toBe(new Date("2026-10-01T12:00:00").toISOString());
    expect(RETENTION_DAYS).toBe(14);
  });
});

describe("5-step ladder: edge cases", () => {
  it("14-day boundary in calendar days (device time): 13 days → マスター, 14 → 定着, whatever the hour", () => {
    expect(lv([page("2026-10-01", [[U, "○"]]), page("2026-10-14", [[U, "○"]])]).level).toBe(3);
    expect(lv([page("2026-10-01", [[U, "○"]]), page("2026-10-15", [[U, "○"]])]).level).toBe(4);
    // late on the 1st, early on the 15th: still 14 calendar days
    expect(lv([page("2026-10-01", [[U, "○"]], "23:50:00"), page("2026-10-15", [[U, "○"]], "06:10:00")]).level).toBe(4);
    expect(calendarDays(new Date(2026, 9, 1, 23, 50).toISOString(), new Date(2026, 9, 15, 6, 10).toISOString())).toBe(14);
  });
  it("a ✕ page in between resets 定着 to マスター (even when that ✕ was reviewed)", () => {
    const base = [page("2026-09-20", [[U, "○"]]), page("2026-10-15", [[U, "○"]])];
    expect(lv(base).level).toBe(4);
    expect(lv([...base, page("2026-10-05", [[U, "○"], [U, "✕"]])]).level).toBe(3);
    expect(lv([...base, page("2026-10-05", [[U, "✕", { reviewed: true }]])]).level).toBe(3);
    // the ✕ page restarts the count: 定着 again 14 days after the first all-○ page after it
    const after = [...base, page("2026-10-05", [[U, "✕"]]), page("2026-10-06", [[U, "○"]])];
    expect(lv(after).level).toBe(3);
    expect(lv(after).reasons.settleDay).toBe("2026-10-20");
    expect(lv([...after, page("2026-10-20", [[U, "○"]])]).level).toBe(4);
  });
  it("a page in between with only unmarked problems (null) is not a ✕ page; it is not an all-○ page either", () => {
    expect(lv([page("2026-10-01", [[U, "○"]]), page("2026-10-08", [[U, null]]), page("2026-10-15", [[U, "○"]])]).level).toBe(4);
    expect(lv([page("2026-10-01", [[U, null]]), page("2026-10-15", [[U, "○"]])]).level).toBe(3);
  });
  it("teacher, AI and parent marks all count as marks; null marks do not make ○", () => {
    for (const source of ["teacher", "ai", "parent"] as const) {
      expect(lv([page("2026-10-01", [[U, "○", { source }]]), page("2026-10-15", [[U, "○", { source }]])]).level, source).toBe(4);
      expect(lv([page("2026-10-10", [[U, "✕", { source }]])]).level, source).toBe(1);
    }
    expect(lv([page("2026-10-15", [[U, "○"], [U, null]])]).level).toBe(2); // one unmarked: not all ○
  });
  it("a later all-○ page makes it マスター even with older unreviewed ✕ (they stay in 念のため)", () => {
    const pages = [page("2026-10-01", [[U, "✕"], [U, "✕"]]), page("2026-10-10", [[U, "○"]])];
    expect(lv(pages)).toMatchObject({ level: 3, reasons: { pending: 2 } });
    expect(splitTestList(pages, [U]).nennotame).toHaveLength(2);
    expect(goldUnits(pages).has(U)).toBe(true);
  });
  it("the newest page decides: an all-○ page followed by a ✕ page is 挑戦中; ties keep the page earlier in the list", () => {
    expect(lv([page("2026-10-01", [[U, "○"]]), page("2026-10-10", [[U, "✕"]])]).level).toBe(1);
    const a = page("2026-10-10", [[U, "○"]]);
    const b = { ...page("2026-10-10", [[U, "✕"]]), createdAt: a.createdAt };
    expect(lv([a, b]).level).toBe(3);
    expect(lv([b, a]).level).toBe(1);
  });
  it("order in the array does not matter (apart from exact ties); 定着 needs ≥ 1 problem on the earlier page", () => {
    const pages = [page("2026-10-15", [[U, "○"]]), page("2026-10-01", [[U, "○"]])];
    expect(lv(pages).level).toBe(4);
    expect(lv([page("2026-10-01", [["5-A1", "○"]]), page("2026-10-15", [[U, "○"]])]).level).toBe(3);
  });
  it("daysLeft counts down to the settle day and stops at 0; now never changes the level", () => {
    const pages = [page("2026-10-10", [[U, "○"]])];
    expect(lv(pages, U, new Date(2026, 9, 23, 9)).reasons.daysLeft).toBe(1);
    expect(lv(pages, U, new Date(2026, 9, 24, 9)).reasons.daysLeft).toBe(0);
    expect(lv(pages, U, new Date(2026, 10, 30)).reasons.daysLeft).toBe(0);
    expect(lv(pages, U, new Date(2026, 10, 30)).level).toBe(3);
  });
  it("unitLevels = unitLevel for every unit with data; the map tiles carry the same steps", () => {
    const pages = [page("2026-10-01", [[U, "○"], ["5-A1", "✕"]]), page("2026-10-15", [[U, "○"], ["5-B1", "○"]])];
    const all = unitLevels(pages, NOW);
    for (const id of [U, "5-A1", "5-B1"]) expect(all.get(id)).toEqual(lv(pages, id));
    const tiles = mapTiles(pages, NOW);
    expect(tiles.find((t) => t.unit.id === U)).toMatchObject({ level: 4, key: "settled", count: 2 });
    expect(tiles.find((t) => t.unit.id === "5-A1")).toMatchObject({ level: 1, key: "trying", wrong: 1 });
    expect(tiles.find((t) => t.unit.id === "5-A2")).toMatchObject({ level: 0, key: "mada", count: 0 });
  });
  it("old four-state names map onto the ladder (back-compat)", () => {
    expect(LEGACY_LEVEL).toEqual({ empty: 0, review: 1, ok: 2, gold: 3 });
    expect([0, 1, 2, 3, 4].map((l) => legacyStatus(l as 0))).toEqual(["empty", "review", "ok", "gold", "gold"]);
  });
});

describe("ladder copy: counts line and next step", () => {
  it("「定着 1 ・ マスター 2 ・ 挑戦中 1」: highest first, empty steps and まだ left out", () => {
    expect(countsLine({ ...zeroCounts(), settled: 1, master: 2, trying: 1, mada: 9 })).toBe("定着 1 ・ マスター 2 ・ 挑戦中 1");
    expect(countsLine({ ...zeroCounts(), reviewed: 2, trying: 1 })).toBe("復習ずみ 2 ・ 挑戦中 1");
    expect(countsLine(zeroCounts())).toBe("");
  });
  it("one line per step on what makes the next step (Lv3 with the date from which 定着 is possible)", () => {
    expect(nextStepLine(lv([]))).toBe("この単元のページを撮ると、記録が始まります。");
    expect(nextStepLine(lv([page("2026-10-10", [[U, "✕"]])]))).toBe("✕の問題を解き直して「復習した」にすると『復習ずみ』です。");
    expect(nextStepLine(lv([page("2026-10-10", [[U, "✕", { reviewed: true }]])]))).toBe("次のページで全問○なら『マスター』です。");
    expect(nextStepLine(lv([page("2026-10-05", [[U, "○"]])], U, new Date(2026, 9, 6, 19)))).toBe("2週間後にもう一度全問○なら『定着』です（10/19以降）。");
    expect(nextStepLine(lv([page("2026-10-01", [[U, "○"]])]))).toBe("次のページでもう一度全問○なら『定着』です。");
    expect(nextStepLine(lv([page("2026-10-01", [[U, "○"]]), page("2026-10-15", [[U, "○"]])]))).toBe("いちばん上の段です。ときどき解き直して、保ちましょう。");
  });
  it("the words: 挑戦中 replaces 復習が必要 everywhere in the in-app copy", () => {
    expect(JSON.stringify(app)).not.toContain("復習が必要");
    expect(JSON.stringify(app)).not.toContain("要復習");
    expect(Object.values(app.ladder.names)).toEqual(["まだ", "挑戦中", "復習ずみ", "マスター", "定着"]);
  });
});

describe("the ladder across the app", () => {
  const pages = [
    page("2026-09-28", [["5-C3", "○"], ["5-B1", "○"]]),
    page("2026-10-15", [["5-C3", "○"], ["5-B1", "○"], ["5-D2", "✕"], ["5-A1", "✕", { reviewed: true }]]),
    page("2026-10-18", [["5-B1", "○"]]),
  ];
  it("report and HUD count by step; 制覇 = units with data (Lv ≥ 1), label unchanged", () => {
    const r = buildReport(pages, "小5", NOW);
    expect(r.counts).toEqual({ settled: 2, master: 0, reviewed: 1, trying: 1, mada: 11 });
    expect(r.chips.settled.map((u) => u.id)).toEqual(["5-B1", "5-C3"]);
    expect(r.next.map((n) => n.unit.id)).toEqual(["5-D2"]);
    const hud = buildHud(pages, "小5", NOW);
    expect(hud).toMatchObject({ taken: 4, total: 15, levelsLine: "定着 2 ・ 復習ずみ 1 ・ 挑戦中 1", flagged: 1 });
  });
  it("tile names, the yearly record and the sheet data follow the ladder", () => {
    const tiles = mapTiles(pages, NOW);
    expect(tileLabel(tiles.find((t) => t.unit.id === "5-C3")!)).toBe("小5 割合：定着");
    expect(tileLabel(tiles.find((t) => t.unit.id === "5-D2")!)).toBe("小5 平均：挑戦中（✕1）");
    expect(yearlyRecord(pages, "小5", NOW)[0]).toMatchObject({ taken: 4, total: 15 });
    expect(sheetData("5-C3", tiles)!.tile).toMatchObject({ level: 4 });
    expect(unitSheet(pages, "5-C3", NOW)).toMatchObject({ gold: true, ladder: { level: 4 }, next: "いちばん上の段です。ときどき解き直して、保ちましょう。" });
  });
  it("テスト前モード: ✕ of a 定着 range unit go to ③ 念のため like マスター's", () => {
    const ps = [page("2026-09-20", [[U, "✕"]]), page("2026-09-28", [[U, "○"]]), page("2026-10-15", [[U, "○"]])];
    expect(lv(ps).level).toBe(4);
    const plan = buildPlan(ps, [U]);
    expect(plan.first).toEqual([]);
    expect(plan.extra.map((i) => i.unit.id)).toEqual([U]);
  });
  it("the map shows every step: column look per tile, crown + glow only on 定着, legend of five", () => {
    const h = html(createElement(TerritoryMap, { tiles: mapTiles(pages, NOW), grade: "小5", selected: null, onSelect: () => {}, lit: [], pointed: null, sheetOpen: false, api: { current: null } }));
    const btn = (id: string) => h.match(new RegExp(`<button [^>]*data-unit="${id}"[^>]*>.*?</button>`))?.[0] ?? "";
    expect(btn("5-C3")).toContain('data-level="4"');
    expect(btn("5-C3")).toContain("terr-crown");
    expect(btn("5-C3")).not.toContain("terr-star");
    expect(btn("5-D2")).toContain("terr-flag");
    expect(btn("5-A1")).toContain('data-status="reviewed"');
    expect(h).toContain('aria-label="小5 深い森林帯：制覇 4／15（定着 2 ・ 復習ずみ 1 ・ 挑戦中 1）"');
    // glyph heights rise with the step
    const tops = [0, 1, 2, 3, 4].map((l) => {
      const g = html(createElement(TerrGlyph, { level: l as 0 }));
      return Number(g.match(/class="tg-body" points="[\d.]+,([\d.]+)/)![1]);
    });
    for (let i = 1; i < 5; i++) expect(tops[i]).toBeLessThan(tops[i - 1]);
  });
});

describe("YouTube: one channel link", () => {
  it("channel and per-unit search URLs (encoded topic)", () => {
    expect(YOUTUBE_CHANNEL_URL).toBe("https://www.youtube.com/@Domo-ai");
    expect(channelUrl()).toBe("https://www.youtube.com/@Domo-ai");
    expect(unitVideoUrl("割合")).toBe("https://www.youtube.com/@Domo-ai/search?query=%E5%89%B2%E5%90%88");
    expect(unitVideoUrl("比例 と 反比例&?")).toBe("https://www.youtube.com/@Domo-ai/search?query=%E6%AF%94%E4%BE%8B%20%E3%81%A8%20%E5%8F%8D%E6%AF%94%E4%BE%8B%26%3F");
    expect(decodeURIComponent(new URL(unitVideoUrl("数量の関係を表す式")).searchParams.get("query")!)).toBe("数量の関係を表す式");
  });
  const pages = [page("2026-10-05", [[U, "○"]])];
  it("unit sheet: ladder bar (●●●●○ マスター) + next step under the title, the button near the problems (new tab)", () => {
    const h = html(
      createElement(Sheet, {
        data: sheetData(U, mapTiles(pages, NOW))!, record: unitSheet(pages, U, new Date(2026, 9, 6, 19)), grade: "小5", hidden: false,
        onClose: () => {}, onPick: () => {}, onOpenPage: () => {}, onTick: () => {}, tour: null,
      }),
    );
    expect(h).toContain('data-testid="sheet-ladder" data-level="3"');
    expect(h.match(/class="ld is-on/g)).toHaveLength(4);
    expect(h).toContain('aria-label="習熟の段階：5段階のうち4段目「マスター」"');
    expect(h).toContain("2週間後にもう一度全問○なら『定着』です（10/19以降）。");
    const a = h.match(/<a [^>]*data-testid="sheet-youtube"[^>]*>.*?<\/a>/)?.[0] ?? "";
    expect(a).toContain(`href="${unitVideoUrl("割合")}"`);
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="noopener"');
    expect(a).toContain("解説動画（YouTube）");
    expect(h).toContain("動画がまだない単元もあります");
    // near the problems: inside the 問題 section, before its list
    expect(h.indexOf('data-testid="sheet-youtube"')).toBeGreaterThan(h.indexOf('data-testid="sheet-problems"'));
    expect(h.indexOf('data-testid="sheet-youtube"')).toBeLessThan(h.indexOf('data-testid="unit-problems"'));
  });
  it("plan header: one channel button (not per card)", () => {
    const s = html(
      createElement(PlanSheet, {
        plan: buildPlan(founderPages(), RANGE), day: "2026-10-20", now: NOW, hidden: false,
        onClose: () => {}, onTick: () => {}, onOpenPage: () => {}, onShare: () => {}, onChange: () => {}, focusUnit: null,
      }),
    );
    expect(s.match(/data-testid="plan-youtube"/g)).toHaveLength(1);
    expect(s).toMatch(/<a [^>]*href="https:\/\/www.youtube.com\/@Domo-ai"[^>]*target="_blank" rel="noopener"[^>]*data-testid="plan-youtube"/);
    expect(s.indexOf('data-testid="plan-youtube"')).toBeLessThan(s.indexOf('data-testid="plan-body"'));
  });
});
