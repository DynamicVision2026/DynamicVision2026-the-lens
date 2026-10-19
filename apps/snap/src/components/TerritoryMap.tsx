import { type MutableRefObject, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import { type Level, countsLine } from "../lib/ladder";
import type { Tile } from "../lib/review";
import { cameraStep } from "../lib/layers";
import { useLayout } from "../lib/layout";
import { rootIds } from "../lib/starmap";
import {
  type Box,
  type Cam,
  type ColorKey,
  GROUND,
  HEIGHT,
  HEX,
  type TerrHex,
  type View,
  clampCam,
  drawOrder,
  easeBack,
  frameBox,
  hexCorners,
  hitUnit,
  homeCam,
  lerpCam,
  lookOf,
  openRegion,
  panBy,
  project,
  refitCam,
  territory,
  tileLabel,
  toWorld,
  unionBox,
  unitBox,
  zoneName,
  zoneProgress,
  zoomAt,
} from "../lib/territory";
import { type Palette, type RGBA, TERRAIN_TOKENS, css, mix, paintTerrain } from "./terrainPaint";

/** テスト前モード on the map: the range outlined, the rest dimmed while picking, tonight's units pulsing. */
export interface ExamLook {
  range: Set<string>;
  /** Picking the range: everything but the range is dimmed and zone labels offer 「この地帯を全部」. */
  dim: boolean;
  /** Units with plan items still to do tonight (a light pulse). */
  todo: Set<string>;
  onZone?: (g: Grade) => void;
  zoneFull?: (g: Grade) => boolean;
}

/** What the HUD can ask the map to do. */
export interface MapApi {
  /** Back to the child's island (the 現在地 compass). */
  home(): void;
  /** ± buttons: zoom around the screen centre. */
  zoom(f: number): void;
  /** Bring units into view: the whole screen, or the band above the open sheet. */
  frameUnits(ids: string[], where?: "full" | "top"): void;
  /** Fly to a grade's zone (年度の記録). */
  flyToGrade(g: Grade): void;
}

const TOKENS = [
  ...TERRAIN_TOKENS, "unex", "num", "geo", "rel", "data", "h-i", "h-ii", "h-iii", "h-a", "h-b", "h-c", "gold", "gold-glint", "settled-glow", "root", "range", "veil",
] as const;
const COLOR_TOKEN: Record<ColorKey, string> = {
  num: "num", geo: "geo", rel: "rel", data: "data", hI: "h-i", hII: "h-ii", hIII: "h-iii", hA: "h-a", hB: "h-b", hC: "h-c",
};

/**
 * A token's value → RGBA (the values live in theme/tokens.css only). The build minifies them, so
 * every hex form (3, 4, 6, 8 digits) and rgb(a)(…) are read.
 */
export function parseColor(s: string): RGBA {
  const v = s.trim();
  if (v.startsWith("#")) {
    let h = v.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const n = v.match(/[\d.]+/g)?.map(Number) ?? [];
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
}

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const p: Palette = {};
  for (const t of TOKENS) p[t] = parseColor(cs.getPropertyValue(`--terr-${t}`) || "0,0,0");
  return p;
}

/** Fill colours of a column: body (rim), cap, left / right side faces, crisp top edge. */
interface Shades {
  body: string;
  cap: string;
  left: string;
  right: string;
  edge: string;
}
function shades(base: RGBA, p: Palette, capT = 0.34): Shades {
  return {
    body: css(base),
    cap: css(mix(base, p.white, capT)),
    left: css(mix(base, p.black, 0.12)),
    right: css(mix(base, p.black, 0.3)),
    edge: css(mix(base, p.black, 0.38)),
  };
}

/** Terrain is painted into an offscreen canvas per zoom (view + a margin) and blitted while panning. */
interface TerrainCache {
  cv: HTMLCanvasElement;
  k: number;
  /** World point at the cache's top-left, and its size in CSS px. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  dpr: number;
}
const CACHE_MARGIN = 0.35;
/** After the last pinch / wheel step, wait this long before repainting the terrain sharp. */
const SETTLE_MS = 160;

/** Axial neighbour across each top-face edge (corner i → i+1 of hexCorners, pointy-top). */
const EDGE_DIRS: [number, number][] = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];

const RISE_MS = 800;
const FLY_MS = 650;
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function TerritoryMap(props: {
  tiles: Tile[];
  grade: Grade;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Units of the page just saved: the camera flies to them and they rise. */
  lit: string[];
  /** A unit 次にやること is pointing at (a stronger pulse). */
  pointed: string | null;
  /** The detail sheet is open: frames go to the band above it. */
  sheetOpen: boolean;
  api: MutableRefObject<MapApi | null>;
  /** テスト前モード (null when off). */
  exam?: ExamLook | null;
}) {
  const { tiles, grade, selected, onSelect, lit, pointed, sheetOpen } = props;
  const exam = props.exam ?? null;
  const T = territory();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ w: 390, h: 640 });
  const cam = useRef<Cam | null>(null);
  const fly = useRef<{ from: Cam; to: Cam; start: number } | null>(null);
  const rise = useRef<{ ids: Set<string>; start: number } | null>(null);
  const palette = useRef<Palette | null>(null);
  const frame = useRef(0);
  const cache = useRef<TerrainCache | null>(null);
  const lastZoom = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelById = useMemo(() => new Map(tiles.map((t) => [t.unit.id, t.level])), [tiles]);
  const status = useCallback((id: string): Level => levelById.get(id) ?? 0, [levelById]);
  const items = useMemo(() => drawOrder(T.hexes), [T]);
  const cellUnit = useMemo(() => new Map(T.hexes.map((t) => [`${t.q},${t.r}`, t.unitId])), [T]);
  const progress = useMemo(() => zoneProgress(tiles), [tiles]);
  const litSet = useMemo(() => new Set(lit), [lit]);
  // tablets: zone labels, trail badges and flags a little larger on the big canvas (phone unchanged)
  const big = useLayout().big;
  const labelScale = big ? 1.15 : 1;
  /** The camera is at the child's zone (load, 現在地): a rotation re-homes instead of keeping the point. */
  const homed = useRef(false);
  /** Home view of a grade's zone; in landscape the zone keeps clear of the HUD's left column (measured). */
  const homeOf = useCallback(
    (g: Grade) => {
      const v = view.current;
      let inset = 0;
      if (v.w > v.h) {
        const tl = wrap.current?.parentElement?.querySelector(".hud-tl")?.getBoundingClientRect();
        const wl = wrap.current?.getBoundingClientRect().left ?? 0;
        if (tl) inset = tl.right - wl + 12;
      }
      return homeCam(T, g, v, inset);
    },
    [T],
  );

  /** Rise progress of a unit (0 = still flat, 1 = up); 1 when it is not rising. */
  const riseOf = useCallback((id: string, now: number) => {
    const r = rise.current;
    if (!r || !r.ids.has(id)) return 1;
    return Math.max(0, Math.min(1, (now - r.start) / RISE_MS));
  }, []);

  const heightOf = useCallback(
    (t: TerrHex, now = performance.now()) => {
      const target = lookOf(status(t.unitId)).height(t.h);
      const k = riseOf(t.unitId, now);
      return k >= 1 ? target : HEIGHT.empty + (target - HEIGHT.empty) * Math.max(0, easeBack(k));
    },
    [status, riseOf],
  );

  // ---------- drawing ----------
  const drawRef = useRef<() => void>(() => {});
  const tick = useCallback(() => drawRef.current(), []);
  const draw = useCallback(() => {
    frame.current = 0;
    const cv = canvas.current;
    const c = cam.current;
    const p = palette.current;
    if (!cv || !c || !p) return;
    const now = performance.now();
    let animating = false;
    if (fly.current) {
      const t = Math.min(1, (now - fly.current.start) / FLY_MS);
      cam.current = lerpCam(fly.current.from, fly.current.to, t);
      if (t >= 1) fly.current = null;
      else animating = true;
    }
    if (rise.current) {
      if (now - rise.current.start < RISE_MS) animating = true;
      else if (now - rise.current.start > RISE_MS + 50) rise.current = null;
      else animating = true;
    }
    const cm = cam.current!;
    const { w, h } = view.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const ox = w / 2 - cm.x * cm.k;
    const oy = h / 2 - cm.y * cm.k;
    const px = 1 / cm.k; // one screen pixel in world units
    const [vx0, vy0] = [-ox / cm.k, -oy / cm.k];
    const [vx1, vy1] = [vx0 + w / cm.k, vy0 + h / cm.k];

    // terrain: from the offscreen cache (repainted when the zoom settles or the view leaves it)
    const zooming = animating || now - lastZoom.current < SETTLE_MS;
    let tc = cache.current;
    const covers = (c: TerrainCache) => c.x0 <= vx0 && c.y0 <= vy0 && c.x0 + c.w / c.k >= vx1 && c.y0 + c.h / c.k >= vy1;
    const ratio = tc ? cm.k / tc.k : 1;
    if (!tc || tc.dpr !== dpr || !covers(tc) || ratio < 0.6 || ratio > 1.7 || (!zooming && Math.abs(ratio - 1) > 1e-4)) {
      const W = w * (1 + 2 * CACHE_MARGIN);
      const H = h * (1 + 2 * CACHE_MARGIN);
      const cv2 = tc?.cv ?? document.createElement("canvas");
      cv2.width = Math.round(W * dpr);
      cv2.height = Math.round(H * dpr);
      const c2 = cv2.getContext("2d");
      const x0 = cm.x - W / 2 / cm.k;
      const y0 = cm.y - H / 2 / cm.k;
      if (c2) {
        c2.setTransform(dpr * cm.k, 0, 0, dpr * cm.k, -x0 * cm.k * dpr, -y0 * cm.k * dpr);
        paintTerrain(c2, T, p, { x0, y0, x1: x0 + W / cm.k, y1: y0 + H / cm.k }, px);
      }
      tc = cache.current = { cv: cv2, k: cm.k, x0, y0, w: W, h: H, dpr };
    } else if (zooming && Math.abs(ratio - 1) > 1e-4 && !animating) {
      // pinch / wheel: blit scaled now, repaint sharp once the fingers rest
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        settle.current = null;
        if (!frame.current) frame.current = requestAnimationFrame(tick);
      }, SETTLE_MS + 10);
    }
    const r = cm.k / tc.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tc.cv, ((tc.x0 - cm.x) * cm.k + w / 2) * dpr, ((tc.y0 - cm.y) * cm.k + h / 2) * dpr, tc.w * r * dpr, tc.h * r * dpr);
    // picking the range (テスト前モード): the land dims so the tiles to tap stand out
    if (exam?.dim) {
      ctx.fillStyle = css(p.veil);
      ctx.fillRect(0, 0, cv.width, cv.height);
    }

    ctx.setTransform(dpr * cm.k, 0, 0, dpr * cm.k, dpr * ox, dpr * oy);
    // tiles, back to front, on their zone's ground
    const shadeCache = new Map<string, Shades>();
    const shadeFor = (k: string, base: () => RGBA) => {
      let sh = shadeCache.get(k);
      if (!sh) shadeCache.set(k, (sh = k === "settled" ? { ...shades(base(), p), cap: css(mix(base(), p["gold-glint"], 0.75)) } : shades(base(), p)));
      return sh;
    };
    const poly = (pts: [number, number][]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    };
    const column = (x: number, z: number, e: number, hh: number, sh: Shades, selectedStroke: string | null, glow = false) => {
      const [cx, cyTop] = project(x, z, e + hh);
      const [, cyBase] = project(x, z, e);
      const top = hexCorners(cx, cyTop, HEX.tile);
      if (cyBase - cyTop > 0.02) {
        const base = hexCorners(cx, cyBase, HEX.tile);
        ctx.fillStyle = sh.left; // lower-left face (sun from the left)
        poly([top[3], top[4], base[4], base[3]]);
        ctx.fill();
        ctx.fillStyle = sh.right;
        poly([top[2], top[3], base[3], base[2]]);
        ctx.fill();
      }
      ctx.fillStyle = sh.body;
      poly(top);
      ctx.fill();
      ctx.strokeStyle = selectedStroke ?? sh.edge;
      ctx.lineWidth = selectedStroke ? 0.07 : Math.min(0.05, px * 0.9);
      ctx.stroke();
      ctx.fillStyle = sh.cap;
      poly(hexCorners(cx, cyTop, HEX.cap));
      ctx.fill();
      if (glow) {
        // 定着: a solid light cap with a crisp rim
        ctx.strokeStyle = css(p.white);
        ctx.lineWidth = Math.max(0.04, px * 1.2);
        poly(hexCorners(cx, cyTop, HEX.cap));
        ctx.stroke();
      }
    };
    // まだ = the zone's own ground (unexplored terrain), lifted a little so it still reads as a tile
    const groundOf = (g: Grade) => p[`g-${GROUND[T.byGrade.get(g)!.zone]}`];
    const unexOf = (u: { grade: Grade; color: ColorKey }) => {
      const g = groundOf(u.grade);
      // light ground (ice, snow): a shade darker so the tile still reads; elsewhere a shade lighter
      const light = (0.299 * g[0] + 0.587 * g[1] + 0.114 * g[2]) / 255 > 0.82;
      return mix(light ? mix(g, p.root, 0.13) : mix(g, p.white, 0.3), p[COLOR_TOKEN[u.color]], 0.08);
    };
    const rangeTops: [number, number][] = [];
    const glowEdges: [[number, number], [number, number]][] = [];
    for (const t of items) {
      if (t.x < vx0 - 2 || t.x > vx1 + 2) continue;
      const yb = t.z * 0.72 - t.e * 0.7;
      if (yb < vy0 - 2 || yb > vy1 + 8) continue;
      const u = T.byId.get(t.unitId)!;
      const st = status(t.unitId);
      const look = lookOf(st);
      const k = riseOf(t.unitId, now);
      let sh: Shades;
      if (k < 1) {
        // rising: colour comes in as it lifts (video: unexplored → strand)
        const to = look.fill === "gold" ? p.gold : p[COLOR_TOKEN[u.color]];
        sh = shades(mix(unexOf(u), to, Math.min(1, k * 1.6)), p);
      } else if (look.fill === "unex") sh = shadeFor(`u-${u.grade}-${u.color}`, () => unexOf(u));
      else if (look.glow) sh = shadeFor("settled", () => p.gold);
      else if (look.fill === "gold") sh = shadeFor("gold", () => p.gold);
      else sh = shadeFor(u.color, () => p[COLOR_TOKEN[u.color]]);
      const inRange = !!exam?.range.has(t.unitId);
      if (exam?.dim && !inRange) {
        // outside the range while picking: the same tile, sunk into the veil
        const base = sh;
        sh = shadeFor(`dim-${base.body}`, () => mix(parseColor(base.body), mix(p.black, p.veil, 0.5), 0.5));
      }
      const hh = heightOf(t, now);
      const glow = look.glow && k >= 1 && !(exam?.dim && !inRange);
      column(t.x, t.z, t.e, hh, sh, t.unitId === selected ? css(p.white) : null, glow);
      if (glow) {
        // only the patch's outer edges glow (a neighbour of the same unit shares the edge)
        const [cx, cy] = project(t.x, t.z, t.e + hh);
        const cs = hexCorners(cx, cy, HEX.tile);
        EDGE_DIRS.forEach(([dq, dr], i) => {
          if (cellUnit.get(`${t.q + dq},${t.r + dr}`) !== t.unitId) glowEdges.push([cs[i], cs[(i + 1) % 6]]);
        });
      }
      if (inRange) rangeTops.push(project(t.x, t.z, t.e + hh));
    }
    // 定着: a subtle warm glow around the top faces, over the columns (two soft strokes, no blur)
    if (glowEdges.length) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = css(p["settled-glow"]);
      for (const lw of [0.36, 0.18]) {
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (const [a, b] of glowEdges) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
      }
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
    }
    // range tiles (テスト前モード): a bright outline with a dark casing on every hex of the unit, drawn
    // over the columns so it reads on gold, red and unexplored tiles alike
    if (rangeTops.length) {
      const wd = Math.max(0.08, px * 2.6);
      ctx.lineJoin = "round";
      for (const [lw, col] of [[wd * 2.4, mix(p.black, p.veil, 0.4)], [wd, p.range]] as const) {
        ctx.strokeStyle = css(col);
        ctx.lineWidth = lw;
        for (const [cx, cy] of rangeTops) {
          poly(hexCorners(cx, cy, HEX.tile));
          ctx.stroke();
        }
      }
      ctx.lineJoin = "miter";
    }

    // root routes of the open unit: dashed sea lines to its roots on other islands
    if (selected && T.byId.has(selected)) {
      const a = T.byId.get(selected)!.anchor;
      const [ax, ay] = project(a.x, a.z, a.e + heightOf(a, now));
      ctx.strokeStyle = css(p.root);
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([6 * px, 5 * px]);
      for (const r of rootIds(selected)) {
        const b = T.byId.get(r)?.anchor;
        if (!b) continue;
        const [bx, by] = project(b.x, b.z, b.e + heightOf(b, now));
        const mx = (ax + bx) / 2;
        const my = Math.min(ay, by) - Math.hypot(bx - ax, by - ay) * 0.25;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // HTML layer (buttons, flags, labels) follows the same camera with one transform
    const ly = layer.current;
    if (ly) {
      ly.style.transform = `translate(${ox}px, ${oy}px) scale(${cm.k})`;
      ly.style.setProperty("--inv", String(1 / cm.k));
      ly.style.setProperty("--k", String(cm.k));
      // flags, crowns and pins keep their screen size, shrinking only when the whole map is in view
      ly.style.setProperty("--mk", String((labelScale * Math.min(1, Math.max(0.42, cm.k / 16))) / cm.k));
      // zone labels and trail badges: full size near, down to 60 % when the whole continent is in view
      ly.style.setProperty("--lk", String((labelScale * Math.min(1, Math.max(0.6, cm.k / 12))) / cm.k));
      for (const el of ly.querySelectorAll<HTMLElement>("[data-unit]")) {
        const id = el.dataset.unit!;
        const a = T.byId.get(id)!.anchor;
        const [x, y] = project(a.x, a.z, a.e + heightOf(a, now));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
    }
    if (animating) frame.current = requestAnimationFrame(tick);
    // tick is stable; it always runs the latest draw (selection, states)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T, items, cellUnit, status, riseOf, heightOf, selected, exam, labelScale]);
  drawRef.current = draw;

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);
  useEffect(() => schedule(), [schedule, draw]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const setCam = useCallback(
    (c: Cam, animate: boolean) => {
      const to = clampCam(c, T, view.current);
      if (!animate || reduceMotion() || !cam.current) {
        fly.current = null;
        cam.current = to;
      } else fly.current = { from: cam.current, to, start: performance.now() };
      schedule();
    },
    [T, schedule],
  );

  const frameUnits = useCallback(
    (ids: string[], where: "full" | "top" = "full", animate = true) => {
      const boxes: Box[] = ids.map((id) => T.byId.get(id)).filter((u) => !!u).map((u) => unitBox(u!, status(u!.id)));
      if (boxes.length === 0) return;
      const v = view.current;
      const homeK = homeCam(T, grade, v).k;
      const b = unionBox(boxes);
      let region: Box = { x0: 16, y0: v.h * 0.14, x1: v.w - 16, y1: v.h * 0.86 };
      if (where === "top") {
        // what the open sheet leaves visible (measured; the sheet is fixed to the window): the band above a
        // bottom sheet, or the map left of the side panel in wide layouts
        const sheet = document.querySelector(".sheet")?.getBoundingClientRect();
        const wr = wrap.current?.getBoundingClientRect();
        const ox = wr?.left ?? 0;
        const oy = wr?.top ?? 0;
        const tl = wrap.current?.parentElement?.querySelector(".hud-tl")?.getBoundingClientRect();
        region = openRegion(v, sheet ? { x: sheet.left - ox, y: sheet.top - oy, w: sheet.width, h: sheet.height } : null, tl ? tl.right - ox + 12 : 0);
      }
      homed.current = false;
      const curK = cam.current?.k ?? homeK;
      setCam(frameBox(b, v, T, { fill: where === "top" ? 0.8 : 0.62, region, maxK: Math.max(homeK * 1.25, curK) }), animate);
    },
    [T, grade, status, setCam],
  );

  useImperativeHandle(
    props.api,
    () => ({
      home: () => {
        setCam(homeOf(grade), true);
        homed.current = true;
      },
      zoom: (f) => {
        homed.current = false;
        // rapid taps build on where the camera is going, not where it is mid-flight
        const c = fly.current?.to ?? cam.current;
        if (c) setCam(zoomAt(c, view.current, f, view.current.w / 2, view.current.h / 2, T), true);
      },
      frameUnits: (ids, where) => frameUnits(ids, where),
      flyToGrade: (g) => {
        setCam(homeOf(g), true);
        homed.current = false;
      },
    }),
    [T, grade, setCam, frameUnits, homeOf],
  );

  // ---------- size, palette, first camera ----------
  const started = useRef(false);
  // the latest props / callbacks for the resize handler (it is set up once)
  const latest = useRef({ selected, sheetOpen, frameUnits });
  latest.current = { selected, sheetOpen, frameUnits };
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    palette.current = readPalette(el);
    const measure = () => {
      const w = Math.max(200, el.clientWidth);
      const h = Math.max(200, el.clientHeight);
      const prev = view.current;
      view.current = { w, h };
      if (!started.current) {
        started.current = true;
        const home = homeOf(grade);
        if (lit.length > 0 && !reduceMotion()) {
          // after 保存: start a little further out, fly to the new tiles, then they rise
          cam.current = clampCam({ ...home, k: home.k * 0.7 }, T, view.current);
          rise.current = { ids: new Set(lit), start: performance.now() + FLY_MS };
          frameUnits(lit, "full");
        } else if (lit.length > 0) {
          cam.current = home;
          frameUnits(lit, "full", false);
        } else {
          cam.current = home;
          homed.current = true;
        }
      } else if (cam.current && (prev.w !== w || prev.h !== h)) {
        // rotation / Split View / Slide Over: frame again for the new size (no reload)
        const { selected: sel, sheetOpen: open, frameUnits: frame } = latest.current;
        const target = fly.current?.to ?? cam.current;
        fly.current = null;
        if (before.current) before.current = refitCam(before.current, prev, view.current, T);
        if (homed.current) cam.current = homeOf(grade);
        else cam.current = refitCam(target, prev, view.current, T);
        // an open unit stays beside / above its sheet (the sheet itself moves with the layout)
        if (sel && open) requestAnimationFrame(() => frame([sel, ...rootIds(sel)], "top", false));
      }
      schedule();
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
    // first camera only once; lit is read on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the sheet opening / closing (lib/layers cameraStep): remember the view when it opens, fly back to it
  // when it closes, unless the student moved the map meanwhile. The page viewer over the sheet does not
  // change sheetOpen, so it never moves the camera. Declared before the framing effect below, which
  // runs in the same commit and must see the view from before the sheet.
  const before = useRef<Cam | null>(null);
  const beforeHomed = useRef(false);
  const wasOpen = useRef(false);
  const moved = useRef(false);
  useEffect(() => {
    const step = cameraStep(wasOpen.current, sheetOpen, moved.current);
    wasOpen.current = sheetOpen;
    if (step === "save") {
      before.current = fly.current?.to ?? cam.current;
      beforeHomed.current = homed.current;
      moved.current = false;
    } else if (step === "restore" && before.current) {
      setCam(before.current, true);
      homed.current = beforeHomed.current;
    }
    if (!sheetOpen) before.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  // open unit (tap, 次にやること, ?unit=, a root in the sheet): bring it and its roots above the sheet
  useEffect(() => {
    if (!selected || !started.current) return;
    frameUnits([selected, ...rootIds(selected)], sheetOpen ? "top" : "full");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ---------- gestures ----------
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; dist: number; lastTap: number }>({ moved: false, dist: 0, lastTap: 0 });
  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".terr-hud")) return;
    ptrs.current.set(e.pointerId, local(e));
    if (ptrs.current.size === 1) gesture.current.moved = false;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    fly.current = null;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev || !cam.current) return;
    const cur = local(e);
    const v = view.current;
    if (ptrs.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      if (!gesture.current.moved && Math.hypot(dx, dy) < 6) return; // still a tap
      if (!gesture.current.moved) {
        gesture.current.moved = true;
        wrap.current?.setPointerCapture?.(e.pointerId);
      }
      moved.current = true;
      homed.current = false;
      cam.current = panBy(cam.current, v, dx, dy, T);
    } else if (ptrs.current.size === 2) {
      gesture.current.moved = true;
      moved.current = true;
      homed.current = false;
      ptrs.current.set(e.pointerId, cur);
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      lastZoom.current = performance.now();
      if (gesture.current.dist > 0) cam.current = zoomAt(cam.current, v, d / gesture.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2, T);
      gesture.current.dist = d;
      schedule();
      return;
    }
    ptrs.current.set(e.pointerId, cur);
    schedule();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) gesture.current.dist = 0;
  };
  /** A tap on the canvas (not on a unit button): the unit under it, or close the sheet. */
  const onCanvasClick = (e: React.MouseEvent) => {
    if (gesture.current.moved || !cam.current) return;
    const p = local(e);
    const now = performance.now();
    if (now - gesture.current.lastTap < 320) {
      // double tap: zoom in there
      gesture.current.lastTap = 0;
      moved.current = true;
      homed.current = false;
      setCam(zoomAt(cam.current, view.current, 1.7, p.x, p.y, T), true);
      return;
    }
    gesture.current.lastTap = now;
    const [X, Y] = toWorld(cam.current, view.current, p.x, p.y);
    const id = hitUnit(T, X, Y, (t) => heightOf(t));
    onSelect(id && id !== selected ? id : null);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!cam.current) return;
    const p = local(e);
    moved.current = true;
    homed.current = false;
    lastZoom.current = performance.now();
    cam.current = zoomAt(cam.current, view.current, Math.exp(-e.deltaY * 0.0015), p.x, p.y, T);
    schedule();
  };

  const own = T.byGrade.get(grade)!;
  return (
    <div
      ref={wrap}
      className="terr-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <canvas ref={canvas} className="terr-canvas" onClick={onCanvasClick} aria-hidden data-testid="terr-canvas" />
      <div ref={layer} className="terr-layer" role="group" aria-label={app.map.terr.chartLabel} data-testid="terr-map">
        {T.regions.map((reg) => {
          // zone label: name, then grade + 標高, on the land just above its tiles
          const own = reg.grade === grade;
          const onZone = exam?.dim ? exam.onZone : undefined;
          const full = !!exam?.zoneFull?.(reg.grade);
          return (
            <span
              key={`l-${reg.grade}`}
              className={`terr-reg${own ? " is-own" : ""}${onZone ? " has-zone-btn" : ""}`}
              style={{ left: `${reg.label[0]}px`, top: `${reg.label[1]}px` }}
              data-region={reg.grade}
              aria-hidden={onZone ? undefined : true}
            >
              <b className="reg-name" aria-hidden>{zoneName(reg.grade)}</b>
              <span className="reg-meta" aria-hidden>
                <i>{reg.grade}</i>
                {app.map.terr.elevation(reg.metres)}
              </span>
              {onZone && (
                <button
                  type="button"
                  className={`reg-all${full ? " is-full" : ""}`}
                  onClick={() => onZone(reg.grade)}
                  aria-label={(full ? app.exam.zoneNoneLabel : app.exam.zoneAllLabel)(reg.grade, zoneName(reg.grade))}
                  data-testid="zone-all"
                  data-grade={reg.grade}
                >
                  {full ? app.exam.zoneNone : app.exam.zoneAll}
                </button>
              )}
            </span>
          );
        })}
        {T.regions.map((reg) => {
          // where the trail passes the zone: 制覇 N/M, a planted flag once every unit is taken, and the beacon
          const pr = progress.get(reg.grade)!;
          const own = reg.grade === grade;
          return (
            <span
              key={`w-${reg.grade}`}
              className={`terr-wp${own ? " is-own" : ""}${pr.complete ? " is-done" : ""}`}
              style={{ left: `${reg.waypoint[0]}px`, top: `${reg.waypoint[1]}px` }}
              data-waypoint={reg.grade}
              data-taken={pr.taken}
              data-total={pr.total}
              aria-label={app.map.terr.zoneLabel(zoneName(reg.grade), reg.grade, pr.taken, pr.total, countsLine(pr.counts))}
              role="img"
            >
              <span className="wp-mark" aria-hidden>
                {own && (
                  <span className="terr-here" data-testid="terr-here">
                    <span className="here-pulse" />
                    <svg className="here-pin" viewBox="0 0 24 32" width="24" height="32">
                      <path d="M12 31C12 31 2 18.6 2 11.5a10 10 0 0 1 20 0C22 18.6 12 31 12 31z" />
                      <circle cx="12" cy="11.5" r="3.6" />
                    </svg>
                    <span className="here-label">{app.map.terr.youAreHere}</span>
                  </span>
                )}
                {pr.complete ? (
                  <span className="wp-flag">
                    <svg viewBox="0 0 16 22" width="16" height="22">
                      <path className="wpf-pole" d="M3 21V2" />
                      <path className="wpf-cloth" d="M3.6 2.4h10l-2.6 3.6 2.6 3.6h-10z" />
                    </svg>
                    {app.map.terr.conquered}
                  </span>
                ) : (
                  <span className="wp-badge">
                    {app.map.terr.progress(pr.taken, pr.total)}
                    {pr.taken > 0 && (
                      <span className="wp-lv" data-testid="wp-levels">
                        {countsLine(pr.counts)}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </span>
          );
        })}
        {tiles.map((t) => {
          const u = T.byId.get(t.unit.id);
          if (!u) return null;
          const look = lookOf(t.level);
          const inRange = !!exam?.range.has(t.unit.id);
          const todo = !!exam?.todo.has(t.unit.id);
          return (
            <button
              key={t.unit.id}
              type="button"
              className={`terr-unit st-${t.key}${inRange ? " is-range" : ""}${todo ? " is-todo" : ""}${litSet.has(t.unit.id) ? " is-lit" : ""}${selected === t.unit.id ? " is-sel" : ""}${pointed === t.unit.id ? " is-pointed" : ""}${selected && rootIds(selected).includes(t.unit.id) ? " is-root" : ""}${t.unit.appGrade === grade ? " is-own" : ""}`}
              data-unit={t.unit.id}
              data-status={t.key}
              data-level={t.level}
              aria-label={exam?.dim ? `${tileLabel(t)}（${inRange ? app.exam.inRange : app.exam.notInRange}）` : tileLabel(t)}
              aria-pressed={exam?.dim ? inRange : selected === t.unit.id}
              data-range={exam ? (inRange ? "1" : "0") : undefined}
              onClick={() => {
                if (gesture.current.moved) return;
                onSelect(selected === t.unit.id ? null : t.unit.id);
              }}
            >
              <span className="terr-mark" aria-hidden>
                {todo && <span className="terr-todo" />}
                {look.pulse && <span className="terr-pulse" />}
                {look.flag && (
                  <svg className="terr-flag" viewBox="0 0 20 30" width="20" height="30">
                    <path className="flag-pole" d="M5 29V3" />
                    <path className="flag-cloth" d="M5.5 3h11l-3 4.5 3 4.5h-11z" />
                    <circle className="flag-foot" cx="5" cy="29" r="1.6" />
                  </svg>
                )}
                {look.star && (
                  <svg className="terr-star" viewBox="0 0 24 24" width="22" height="22">
                    <path d="M12 2.5l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L12 15.2 6.9 18.4l1.4-5.9-4.6-3.9 6-.5z" />
                  </svg>
                )}
                {look.crown && (
                  <svg className="terr-crown" viewBox="0 0 28 24" width="26" height="22">
                    <path d="M3 8.5l5.6 4.6L14 4l5.4 9.1L25 8.5l-2.3 11H5.3z" />
                    <path className="crown-band" d="M5.6 19.5h16.8" />
                  </svg>
                )}
              </span>
              {selected === t.unit.id && (
                <span className={`terr-pin c-${u.color}`} aria-hidden>
                  <small>{`${t.unit.appGrade} ${t.unit.level === "高" ? t.unit.grade : t.unit.unit}`}</small>
                  {t.unit.topic}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <span className="sr-only" data-testid="terr-own">{own.grade}</span>
    </div>
  );
}
