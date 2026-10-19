import { describe, expect, it } from "vitest";
import { GRADES } from "../src/curriculum";
import { PANEL, layoutOf, panelWidth } from "../src/lib/layout";
import { cameraStep, closeTop, layersOf, openSheet, openViewer } from "../src/lib/layers";
import { type Box, type View, HOME_FILL, frameBox, homeCam, openRegion, refitCam, territory, toScreen, unitBox } from "../src/lib/territory";

const T = territory();

/** The map's own size per device (window minus top bar + tabs, or minus the rail). */
const MAPS: Record<string, View> = {
  "iPhone portrait": { w: 390, h: 722 },
  "iPad portrait": { w: 820, h: 1060 },
  "iPad landscape": { w: 1092, h: 820 },
  "iPad Pro landscape": { w: 1278, h: 1024 },
  "iPad Pro portrait": { w: 1024, h: 1246 },
  "phone landscape": { w: 768, h: 390 },
  "Split View ⅔": { w: 780, h: 700 },
};

const onScreen = (b: Box, c: ReturnType<typeof homeCam>, v: View) => {
  const [x0, y0] = toScreen(c, v, b.x0, b.y0);
  const [x1, y1] = toScreen(c, v, b.x1, b.y1);
  return { x0, y0, x1, y1 };
};
const trailSeen = (g: (typeof GRADES)[number], c: ReturnType<typeof homeCam>, v: View) => {
  const next = GRADES[GRADES.indexOf(g) + 1];
  const leg = T.terrain.trail.slice(T.terrain.trailAt.get(g)!, T.terrain.trailAt.get(next)! + 1);
  return leg.filter(([x, y]) => {
    const [sx, sy] = toScreen(c, v, x, y);
    return sx >= 0 && sx <= v.w && sy >= 0 && sy <= v.h;
  }).length / leg.length;
};

describe("useLayout breakpoints (lib/layout)", () => {
  it("phone < 600 px; tablet ≥ 600 portrait; wide = landscape ≥ 900 or a phone sideways", () => {
    expect(layoutOf(390, 844)).toEqual({ layout: "phone", big: false, short: false });
    expect(layoutOf(430, 932)).toEqual({ layout: "phone", big: false, short: false });
    expect(layoutOf(820, 1180)).toEqual({ layout: "tablet", big: true, short: false });
    expect(layoutOf(1024, 1366)).toEqual({ layout: "tablet", big: true, short: false });
    expect(layoutOf(1180, 820)).toEqual({ layout: "wide", big: true, short: false });
    expect(layoutOf(1366, 1024)).toEqual({ layout: "wide", big: true, short: false });
    expect(layoutOf(844, 390)).toEqual({ layout: "wide", big: false, short: true });
    expect(layoutOf(932, 430)).toEqual({ layout: "wide", big: false, short: true });
    expect(layoutOf(667, 375)).toEqual({ layout: "wide", big: false, short: true });
    expect(layoutOf(568, 320).layout).toBe("phone"); // iPhone SE sideways: under 600 px
  });

  it("rotation flips the layout; Split View and Slide Over widths fall back to phone or tablet", () => {
    expect(layoutOf(820, 1180).layout).toBe("tablet");
    expect(layoutOf(1180, 820).layout).toBe("wide");
    expect(layoutOf(590, 820).layout).toBe("phone"); // landscape ½
    expect(layoutOf(780, 820).layout).toBe("tablet"); // landscape ⅔
    expect(layoutOf(375, 820).layout).toBe("phone"); // ⅓
    expect(layoutOf(320, 1100).layout).toBe("phone"); // Slide Over
    expect(layoutOf(800, 600).layout).toBe("tablet"); // landscape but narrower than 900 and not short
    expect(layoutOf(600, 1000).layout).toBe("tablet");
    expect(layoutOf(599, 1000).layout).toBe("phone");
  });

  it("side panel width: 36 % of the window, 340–440 px", () => {
    expect(panelWidth(1180)).toBe(425);
    expect(panelWidth(1366)).toBe(PANEL.max);
    expect(panelWidth(844)).toBe(PANEL.min);
  });
});

describe("camera framing per viewport (portrait, landscape, rotation)", () => {
  it("on load the child's zone takes ~70 % of the shorter side and is fully in view, on every device and grade", () => {
    for (const [name, v] of Object.entries(MAPS)) {
      const short = Math.min(v.w, v.h);
      for (const g of GRADES) {
        const c = homeCam(T, g, v);
        const b = onScreen(T.byGrade.get(g)!.box, c, v);
        const share = (b.x1 - b.x0) / short;
        expect(share, `${name} ${g}`).toBeLessThanOrEqual(HOME_FILL + 1e-6);
        expect(share, `${name} ${g}`).toBeGreaterThan(0.4);
        expect(b.x0, `${name} ${g}`).toBeGreaterThanOrEqual(-1);
        expect(b.x1, `${name} ${g}`).toBeLessThanOrEqual(v.w + 1);
        expect(b.y0, `${name} ${g}`).toBeGreaterThanOrEqual(v.h * 0.12 - 1);
        expect(b.y1, `${name} ${g}`).toBeLessThanOrEqual(v.h + 1);
      }
    }
  });

  it("portrait framing is unchanged (70 % of the width, as before v0.12)", () => {
    for (const v of [MAPS["iPhone portrait"], MAPS["iPad portrait"]]) {
      const b = T.byGrade.get("小5")!.box;
      expect(homeCam(T, "小5", v).k * (b.x1 - b.x0)).toBeCloseTo(0.7 * v.w, 3);
    }
  });

  it("landscape shows more of the trail to the next zone than portrait", () => {
    for (const g of GRADES.slice(0, -1)) {
      const p = trailSeen(g, homeCam(T, g, MAPS["iPad portrait"]), MAPS["iPad portrait"]);
      const l = trailSeen(g, homeCam(T, g, MAPS["iPad landscape"]), MAPS["iPad landscape"]);
      expect(l, g).toBeGreaterThanOrEqual(p - 1e-9);
      expect(l, g).toBeGreaterThan(0.6);
    }
  });

  it("landscape: the zone keeps clear of the HUD's left column (inset) when the width allows", () => {
    const v = MAPS["phone landscape"];
    for (const g of GRADES) {
      const b = onScreen(T.byGrade.get(g)!.box, homeCam(T, g, v, 240), v);
      expect(b.x0 >= 240 - 1 || b.x1 >= v.w - 8 - 1, g).toBe(true);
      expect(b.x1, g).toBeLessThanOrEqual(v.w + 1);
    }
  });

  it("rotation keeps the centre point and scales the zoom with the shorter side; re-homing fits the new size", () => {
    const p = MAPS["iPad portrait"];
    const l = MAPS["iPad landscape"];
    const c = homeCam(T, "小5", p);
    const r = refitCam(c, p, l, T);
    expect(r.k).toBeCloseTo(c.k * (820 / 820), 6);
    expect(r.x).toBeCloseTo(c.x, 6);
    expect(r.y).toBeCloseTo(c.y, 6);
    const ph = MAPS["iPhone portrait"];
    const back = refitCam(refitCam(c, p, ph, T), ph, p, T);
    expect(back.k).toBeCloseTo(c.k, 6);
    // rotate there and back: the home view is the same as before
    const again = homeCam(T, "小5", p);
    expect(again).toEqual(c);
    const land = homeCam(T, "小5", l);
    const b = onScreen(T.byGrade.get("小5")!.box, land, l);
    expect(b.x0).toBeGreaterThanOrEqual(0);
    expect(b.x1).toBeLessThanOrEqual(l.w);
  });
});

describe("open sheet: the selected tile stays visible", () => {
  const frame = (v: View, sheet: Parameters<typeof openRegion>[1], id: string, inset = 0) => {
    const u = T.byId.get(id)!;
    const box = unitBox(u, 1);
    const c = frameBox(box, v, T, { fill: 0.8, region: openRegion(v, sheet, inset), maxK: homeCam(T, "小5", v).k * 1.25 });
    return onScreen(box, c, v);
  };

  it("wide: a side panel on the right → the tile is framed left of it (iPad, iPad Pro, phone sideways)", () => {
    for (const [name, v, pw] of [
      ["iPad landscape", MAPS["iPad landscape"], panelWidth(1180)],
      ["iPad Pro landscape", MAPS["iPad Pro landscape"], panelWidth(1366)],
      ["phone landscape", MAPS["phone landscape"], panelWidth(844)],
    ] as const) {
      const sheet = { x: v.w - pw, y: 0, w: pw, h: v.h };
      expect(openRegion(v, sheet).x1, name).toBe(v.w - pw - 16);
      for (const id of ["5-C3", "5-A1", "4-C2", "h-II-4", "1-A1"]) {
        const b = frame(v, sheet, id, 200);
        expect(b.x0, `${name} ${id}`).toBeGreaterThanOrEqual(0);
        expect(b.x1, `${name} ${id}`).toBeLessThan(v.w - pw);
        expect(b.y0, `${name} ${id}`).toBeGreaterThanOrEqual(0);
        expect(b.y1, `${name} ${id}`).toBeLessThanOrEqual(v.h);
      }
    }
  });

  it("the HUD column inset applies beside a panel only when room is left; bottom sheets are unchanged", () => {
    const v = MAPS["iPad landscape"];
    expect(openRegion(v, { x: 667, y: 0, w: 425, h: 820 }, 230).x0).toBe(230);
    expect(openRegion(MAPS["phone landscape"], { x: 428, y: 0, w: 340, h: 390 }, 330).x0).toBe(16); // too narrow: no inset
    // phone / tablet portrait: the band above the bottom sheet (the v0.9 rule, inset ignored)
    const ph = MAPS["iPhone portrait"];
    expect(openRegion(ph, { x: 0, y: 340, w: 390, h: 404 }, 300)).toEqual({ x0: 16, y0: 110, x1: 374, y1: 328 });
    const tp = MAPS["iPad portrait"];
    const sheet = { x: 50, y: 1060 - 531, w: 720, h: 531 };
    const b = frame(tp, sheet, "5-C3");
    expect(b.y1).toBeLessThan(sheet.y);
    expect(b.y0).toBeGreaterThanOrEqual(0);
  });
});

describe("layers and back navigation are the same in every layout", () => {
  it("sheet → viewer → back → back; the camera save / restore rule", () => {
    let l = layersOf(null);
    const s = openSheet(l, "5-C3");
    expect(s.kind).toBe("push");
    l = layersOf(s.kind !== "back" ? s.state : null);
    const vw = openViewer(l, "p1");
    l = layersOf(vw.kind !== "back" ? vw.state : null);
    expect(l).toMatchObject({ sheet: "5-C3", viewer: "p1", d: 2 });
    expect(closeTop(l)).toEqual({ kind: "back" });
    expect(cameraStep(false, true, false)).toBe("save");
    expect(cameraStep(true, false, false)).toBe("restore");
    expect(cameraStep(true, false, true)).toBe("keep");
  });
});
