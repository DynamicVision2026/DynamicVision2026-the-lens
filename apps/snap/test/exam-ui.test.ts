import { type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { type ExamLook, TerritoryMap } from "../src/components/TerritoryMap";
import { buildPlan } from "../src/lib/examplan";
import { type Layers, type NavStep, NO_LAYERS, closeTop, layersOf, openExam, openShare, openSheet, openViewer } from "../src/lib/layers";
import { mapTiles } from "../src/lib/review";
import type { SavedPage } from "../src/lib/model";
import { ExamDate, ExamSummary, PlanSheet, RangeBar } from "../src/screens/ExamMode";
import { RANGE, founderPages } from "./founder-pages";

const html = (el: ReactElement) => renderToStaticMarkup(createElement(MemoryRouter, null, el));
const NOW = new Date(2026, 9, 19, 21, 30); // Mon 19 Oct 2026
const noop = () => {};
const count = (s: string, needle: string) => s.split(needle).length - 1;
const tick = (pages: SavedPage[], pageId: string, index: number): SavedPage[] =>
  pages.map((pg) => (pg.id !== pageId ? pg : { ...pg, problems: pg.problems.map((p, j) => (j === index ? { ...p, reviewed: true } : p)) }));

/** A browser history in miniature (same as layers.test.ts): the map's own entry after the report. */
class FakeHistory {
  entries: { path: string; state: unknown }[] = [
    { path: "/app/report", state: null },
    { path: "/app/map", state: null },
  ];
  i = 1;
  get path() {
    return this.entries[this.i].path;
  }
  get layers(): Layers {
    return layersOf(this.entries[this.i].state);
  }
  apply(step: NavStep | null) {
    if (!step) return;
    if (step.kind === "back") return this.back();
    const e = { path: this.path, state: step.state };
    if (step.kind === "replace") this.entries[this.i] = e;
    else {
      this.entries = [...this.entries.slice(0, this.i + 1), e];
      this.i++;
    }
  }
  back() {
    this.i = Math.max(0, this.i - 1);
  }
}

describe("テスト前モード is a history layer", () => {
  it("entry → date → range → plan is one entry: one back leaves the mode, the next leaves the map", () => {
    const h = new FakeHistory();
    h.apply(openExam(h.layers, "date"));
    expect(h.layers.exam).toBe("date");
    h.apply(openExam(h.layers, "range"));
    h.apply(openExam(h.layers, "plan"));
    expect(h.layers).toMatchObject({ exam: "plan", d: 1 });
    expect(h.entries).toHaveLength(3);
    h.back();
    expect(h.layers).toEqual(NO_LAYERS);
    expect(h.path).toBe("/app/map");
    h.back();
    expect(h.path).toBe("/app/report");
  });
  it("the page viewer and the parent summary sit on the plan: back peels them off, then the mode", () => {
    const h = new FakeHistory();
    h.apply(openExam(h.layers, "plan")); // a current test: the button opens the plan directly
    h.apply(openViewer(h.layers, "live4"));
    expect(h.layers).toMatchObject({ exam: "plan", viewer: "live4" });
    h.back();
    expect(h.layers).toMatchObject({ exam: "plan", viewer: null });
    h.apply(openShare(h.layers));
    expect(h.layers).toMatchObject({ exam: "plan", share: true });
    h.apply(closeTop(h.layers)); // 「作戦にもどる」 / ✕ = back
    expect(h.layers).toMatchObject({ exam: "plan", share: false });
    h.apply(closeTop(h.layers));
    expect(h.layers).toEqual(NO_LAYERS);
    expect(h.path).toBe("/app/map");
  });
  it("「日付・範囲を変える」 replaces the plan with the date step (still one back to the map)", () => {
    const h = new FakeHistory();
    h.apply(openExam(h.layers, "plan"));
    h.apply(openExam(h.layers, "date"));
    expect(h.layers).toMatchObject({ exam: "date", d: 1 });
    h.back();
    expect(h.layers).toEqual(NO_LAYERS);
  });
  it("a unit sheet is replaced by the mode; d = 0 closes in place; odd states are read safely", () => {
    const h = new FakeHistory();
    h.apply(openSheet(h.layers, "5-D2"));
    h.apply(openExam(h.layers, "date"));
    expect(h.layers).toMatchObject({ sheet: null, exam: "date", d: 1 });
    expect(closeTop({ ...NO_LAYERS, exam: "plan", d: 0 })).toEqual({ kind: "replace", state: { snap: NO_LAYERS } });
    expect(closeTop({ ...NO_LAYERS, exam: "plan", share: true, d: 0 })).toEqual({ kind: "replace", state: { snap: { ...NO_LAYERS, exam: "plan" } } });
    expect(layersOf({ snap: { exam: "range", share: true, viewer: "p" } })).toMatchObject({ exam: "range", share: false, viewer: null });
    expect(layersOf({ snap: { exam: "nope" } }).exam).toBeNull();
    expect(openShare({ ...NO_LAYERS, exam: "range" })).toBeNull();
  });
});

describe("entry flow markup", () => {
  it("first it asks one thing: 「テストはいつですか？」 明日 / あさって (with dates) / 日付を選ぶ", () => {
    const s = html(createElement(ExamDate, { now: NOW, initial: null, onPick: noop, onClose: noop }));
    expect(s).toContain("テストはいつですか？");
    expect(s).toContain('data-day="2026-10-20"');
    expect(s).toContain("10/20（火）");
    expect(s).toContain("10/21（水）");
    expect(s).toContain("日付を選ぶ");
    expect(s).toContain('aria-label="テスト前モードを閉じる"');
  });
  it("then the range: count, names, 決定 (disabled with nothing chosen)", () => {
    const s = html(createElement(RangeBar, { range: RANGE, onDecide: noop, onClose: noop }));
    expect(s).toContain("範囲の単元を選んでください");
    expect(s).toContain("範囲 3単元");
    expect(s).toContain("小5 平面図形の面積・割合・平均");
    expect(s).not.toMatch(/data-testid="exam-decide"[^>]*disabled/);
    const none = html(createElement(RangeBar, { range: [], onDecide: noop, onClose: noop }));
    expect(none).toMatch(/disabled=""[^>]*data-testid="exam-decide"/);
  });
  it("on the map while picking: range tiles pressed + outlined, zone buttons 「この地帯を全部」, tonight's units pulse", () => {
    const tiles = mapTiles(founderPages());
    const look: ExamLook = { range: new Set(RANGE), dim: true, todo: new Set(), onZone: noop, zoneFull: () => false };
    const s = html(createElement(TerritoryMap, { tiles, grade: "小5", selected: null, onSelect: noop, lit: [], pointed: null, sheetOpen: false, api: { current: null }, exam: look }));
    expect(count(s, 'data-range="1"')).toBe(3);
    expect(s).toMatch(/aria-label="小5 平均：挑戦中（✕3）（範囲に入っています）" aria-pressed="true"/);
    expect(count(s, 'data-testid="zone-all"')).toBe(12);
    expect(s).toContain("この地帯を全部");
    const plan = html(createElement(TerritoryMap, { tiles, grade: "小5", selected: null, onSelect: noop, lit: [], pointed: null, sheetOpen: true, api: { current: null }, exam: { range: new Set(RANGE), dim: false, todo: new Set(["5-D2", "4-A6"]) } }));
    expect(count(plan, 'class="terr-todo"')).toBe(2);
    expect(count(plan, 'data-testid="zone-all"')).toBe(0);
    expect(count(plan, "is-range")).toBe(3);
  });
});

describe("今夜の作戦 markup", () => {
  const props = { day: "2026-10-20", now: NOW, hidden: false, onClose: noop, onTick: noop, onOpenPage: noop, onShare: noop, onChange: noop, focusUnit: null };
  it("header, plan line, progress count, ①②③ overview, ① ② open and ③ collapsed", () => {
    const s = html(createElement(PlanSheet, { ...props, plan: buildPlan(founderPages(), RANGE) }));
    expect(s).toContain("明日のテスト");
    expect(s).toContain("範囲 3単元");
    expect(s).toContain("今夜やること：4問 ・ めやす 約20分");
    expect(s).toContain("復習した 0 / 4");
    expect(count(s, 'data-testid="overview-row"')).toBe(3);
    expect(s).toContain("まず解き直す");
    expect(s).toContain("小4 数量の関係を表す式 — 小5 平均 のもと");
    expect(count(s, 'data-testid="plan-card"')).toBe(4); // ③'s card stays hidden until opened
    expect(s).toMatch(/aria-expanded="false"[^>]*data-testid="plan-extra-toggle"/);
    expect(s).toContain("共有用にまとめる");
    expect(s).not.toContain('data-testid="plan-done"');
  });
  it("self-check: the AI's answer is behind 「答えを確かめる」; without one, a note where to check", () => {
    const pages = founderPages().map((pg) => (pg.id === "live4" ? { ...pg, photo: { bytes: new ArrayBuffer(1), mime: "image/jpeg" } } : pg));
    const s = html(createElement(PlanSheet, { ...props, plan: buildPlan(pages, RANGE) }));
    expect(count(s, 'data-testid="plan-check"')).toBe(1); // only 480円 has an AI answer among ① ②
    expect(s).not.toContain("480円");
    expect(count(s, "正答（AI）はありません。教科書やプリントで確かめてください。")).toBe(2); // the 5年 pages: no photo
    expect(count(s, "正答（AI）はありません。写真の問題で確かめてください。")).toBe(1); // the live 4年 sheet has its photo
    expect(count(s, 'data-testid="plan-tick"')).toBe(4);
  });
  it("all of ① and ② ticked: a calm completion with what remains in 念のため", () => {
    let pg = founderPages();
    const keys = ["zukei-1", "zukei-2", "live4-1", "live4-2"];
    for (const k of keys) pg = tick(pg, k.split("-")[0], Number(k.split("-")[1]));
    const s = html(createElement(PlanSheet, { ...props, plan: buildPlan(pg, RANGE, keys) }));
    expect(s).toContain("今夜の作戦は完了です");
    expect(s).toContain("念のための見直しがあと1問あります");
    expect(s).toContain("復習した 4 / 4");
  });
  it("units never photographed: a short warning with 「撮る」", () => {
    const s = html(createElement(PlanSheet, { ...props, plan: buildPlan(founderPages(), [...RANGE, "5-A4", "5-A5", "5-B4"]) }));
    expect(s).toContain("まだ撮っていない単元：分数 ほか2");
    expect(s).toMatch(/<a(?=[^>]*href="\/app\/snap")(?=[^>]*data-testid="plan-snap")/);
  });
  it("the parent summary: when, range, tonight, rows, progress, text share; nothing about scores", () => {
    const pg = tick(founderPages(), "live4", 2);
    const s = html(createElement(ExamSummary, { plan: buildPlan(pg, RANGE, ["live4-2"]), day: "2026-10-20", now: NOW, onClose: noop }));
    expect(s).toContain("明日のテスト（10/20）");
    expect(s).toContain("小5 平面図形の面積・割合・平均");
    expect(s).toContain("今夜やること：4問 ・ めやす 約20分");
    expect(s).toContain("復習した 1 / 4");
    expect(s).toContain("1問 済");
    expect(s).toContain("文章で共有する");
    expect(s.replace(/<[^>]*>/g, " ")).not.toMatch(/点数|%|％/);
  });
});
