import { type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SnapFab } from "../src/components/SnapFab";
import { WelcomeCard } from "../src/components/WelcomeCard";
import { buildStrip } from "../src/lib/home";
import { mapTiles } from "../src/lib/review";

const html = (el: ReactElement) => renderToStaticMarkup(createElement(MemoryRouter, null, el));
const text = (h: string) => h.replace(/<[^>]+>/g, "");
/** The <a …>…</a> element carrying data-testid=id. */
const link = (h: string, id: string) => h.match(new RegExp(`<a [^>]*data-testid="${id}"[^>]*>.*?</a>`))?.[0] ?? "";

describe("empty map: the grade's sky + a welcome card (no dead end)", () => {
  it("title with the grade, one line, the four-state legend and a big 「ページを撮る」 → /app/snap", () => {
    const h = html(createElement(WelcomeCard, { grade: "小5" }));
    expect(h).toContain('data-testid="map-welcome"');
    expect(text(h)).toContain("小5の単元マップ");
    expect(text(h)).toContain("プリントやテストを撮ると、その単元の星が光ります。");
    const legend = h.match(/<ul[^>]*welcome-legend[^>]*>(.*?)<\/ul>/)?.[1] ?? "";
    expect(legend.match(/<li>/g)).toHaveLength(4);
    expect(text(legend)).toBe("マスター復習ずみ復習が必要まだ");
    const cta = link(h, "welcome-snap");
    expect(cta).toContain('href="/app/snap"');
    expect(text(cta)).toBe("ページを撮る");
  });

  it("with no pages every star of the grade is faint (まだ) and the strip has nothing to show", () => {
    const tiles = mapTiles([]);
    expect(tiles.filter((t) => t.unit.appGrade === "小5").every((t) => t.status === "empty")).toBe(true);
    expect(buildStrip([], "小5").next).toEqual([]);
  });

  it("the map's floating button opens 撮る", () => {
    const h = html(createElement(SnapFab));
    const fab = link(h, "snap-fab");
    expect(fab).toContain('href="/app/snap"');
    expect(fab).toContain('aria-label="ページを撮る"');
    expect(text(fab)).toBe("撮る");
  });
});
