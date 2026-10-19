import { type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SnapFab } from "../src/components/SnapFab";
import { TerritoryMap } from "../src/components/TerritoryMap";
import { WelcomeCard } from "../src/components/WelcomeCard";
import { buildHud } from "../src/lib/territory";
import { mapTiles } from "../src/lib/review";
import type { SavedPage } from "../src/lib/model";

const html = (el: ReactElement) => renderToStaticMarkup(createElement(MemoryRouter, null, el));
const text = (h: string) => h.replace(/<[^>]+>/g, "");
/** The <a …>…</a> element carrying data-testid=id. */
const link = (h: string, id: string) => h.match(new RegExp(`<a [^>]*data-testid="${id}"[^>]*>.*?</a>`))?.[0] ?? "";

const map = (pages: SavedPage[]) =>
  html(createElement(TerritoryMap, { tiles: mapTiles(pages), grade: "小5", selected: null, onSelect: () => {}, lit: [], pointed: null, sheetOpen: false, api: { current: null } }));

describe("empty map: all unexplored territory + one small card (no dead end)", () => {
  it("one line on how territory is won and a big 「ページを撮る」 → /app/snap", () => {
    const h = html(createElement(WelcomeCard));
    expect(h).toContain('data-testid="map-welcome"');
    expect(text(h)).toContain("プリントを撮ると、その単元が自分の領土になります");
    const cta = link(h, "welcome-snap");
    expect(cta).toContain('href="/app/snap"');
    expect(text(cta)).toBe("ページを撮る");
  });

  it("with no pages every tile is unexplored (まだ), nothing is taken and nothing is flagged", () => {
    const h = map([]);
    expect(h.match(/<button [^>]*class="terr-unit/g)).toHaveLength(110);
    expect(h.match(/data-status="empty"/g)).toHaveLength(110);
    expect(h).not.toContain("terr-flag");
    expect(buildHud([], "小5")).toMatchObject({ taken: 0, flagged: 0, next: [] });
  });

  it("the map's floating button opens 撮る", () => {
    const h = html(createElement(SnapFab));
    const fab = link(h, "snap-fab");
    expect(fab).toContain('href="/app/snap"');
    expect(fab).toContain('aria-label="ページを撮る"');
    expect(text(fab)).toBe("撮る");
  });
});

describe("territory map markup", () => {
  const pages: SavedPage[] = [
    {
      id: "w1", createdAt: "2026-10-18T09:00:00Z", grade: "小5", pageType: "test", score: null,
      problems: [
        { n: 1, q: "a", unit: "5-D2", answer: null, mark: "✕", confidence: 0.9, reviewed: false },
        { n: 2, q: "b", unit: "5-D2", answer: null, mark: "✕", confidence: 0.9, reviewed: false },
        { n: 3, q: "c", unit: "5-A1", answer: null, mark: "○", confidence: 0.9, reviewed: false },
      ],
    },
  ];
  it("every tile is a button named 「小5 平均：復習が必要（✕2）」; flags on red tiles, crowns on gold; 12 zone labels + trail markers", () => {
    const h = map(pages);
    expect(h).toContain('aria-label="小5 平均：復習が必要（✕2）"');
    expect(h).toContain('aria-label="小5 整数の性質：マスター"');
    const red = h.match(/<button [^>]*data-unit="5-D2"[^>]*>.*?<\/button>/)?.[0] ?? "";
    expect(red).toContain("terr-flag");
    expect(red).toContain("terr-pulse");
    const gold = h.match(/<button [^>]*data-unit="5-A1"[^>]*>.*?<\/button>/)?.[0] ?? "";
    expect(gold).toContain("terr-crown");
    expect(h.match(/data-region=/g)).toHaveLength(12);
    expect(h).toMatch(/class="terr-reg is-own"[^>]*data-region="小5"/);
    expect(text(h.match(/<span class="terr-reg is-own".*?<\/span><\/span>/)?.[0] ?? "")).toBe("深い森林帯小5標高 500");
    // trail markers: 制覇 N/M on every zone, 「あなたはここ」 only on the child's
    expect(h.match(/data-waypoint=/g)).toHaveLength(12);
    expect(h).toContain('aria-label="小5 深い森林帯：制覇 2／15"');
    expect(h.match(/あなたはここ/g)).toHaveLength(1);
    expect(h).toMatch(/data-waypoint="小5"[^>]*>.*?あなたはここ.*?制覇 2\/15/);
  });
});
