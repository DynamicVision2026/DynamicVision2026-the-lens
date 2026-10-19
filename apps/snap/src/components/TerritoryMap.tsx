import { type MutableRefObject, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import type { Tile, TileStatus } from "../lib/review";
import { rootIds } from "../lib/starmap";
import {
  type Box,
  type Cam,
  type ColorKey,
  HEIGHT,
  HEX,
  type LandHex,
  PROJ,
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
  panBy,
  project,
  territory,
  tileLabel,
  toWorld,
  unionBox,
  unitBox,
  zoomAt,
} from "../lib/territory";

/** What the HUD can ask the map to do. */
export interface MapApi {
  /** Back to the child's island (the 現在地 compass). */
  home(): void;
  /** ± buttons: zoom around the screen centre. */
  zoom(f: number): void;
  /** Bring units into view: the whole screen, or the band above the open sheet. */
  frameUnits(ids: string[], where?: "full" | "top"): void;
}

type RGBA = [number, number, number, number];
type Palette = Record<string, RGBA>;
const TOKENS = [
  "sea", "sea-haze", "grid", "sand", "sand-gap", "grass", "grass-hs", "unex", "num", "geo", "rel", "data",
  "h-i", "h-ii", "h-iii", "h-a", "h-b", "h-c", "gold", "red", "route", "root", "white", "black",
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
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
const css = (c: RGBA) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const p: Palette = {};
  for (const t of TOKENS) p[t] = parseColor(cs.getPropertyValue(`--terr-${t}`) || "0,0,0");
  return p;
}

/** Fill colours of a column: body (rim), cap, left / right side faces. */
interface Shades {
  body: string;
  cap: string;
  left: string;
  right: string;
}
function shades(base: RGBA, p: Palette, capT = 0.34): Shades {
  return {
    body: css(base),
    cap: css(mix(base, p.white, capT)),
    left: css(mix(base, p.black, 0.12)),
    right: css(mix(base, p.black, 0.3)),
  };
}

const RISE_MS = 800;
const FLY_MS = 650;
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

type Item = { kind: "land"; l: LandHex; x: number; z: number } | { kind: "hex"; t: TerrHex; x: number; z: number };

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
}) {
  const { tiles, grade, selected, onSelect, lit, pointed, sheetOpen } = props;
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
  const statusById = useMemo(() => new Map(tiles.map((t) => [t.unit.id, t.status])), [tiles]);
  const status = useCallback((id: string): TileStatus => statusById.get(id) ?? "empty", [statusById]);
  const items = useMemo<Item[]>(
    () => drawOrder<Item>([...T.land.map((l) => ({ kind: "land" as const, l, x: l.x, z: l.z })), ...T.hexes.map((t) => ({ kind: "hex" as const, t, x: t.x, z: t.z }))]),
    [T],
  );
  const litSet = useMemo(() => new Set(lit), [lit]);

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sea: haze far away (top), the video's sea below
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(p["sea-haze"]));
    g.addColorStop(0.5, css(p.sea));
    g.addColorStop(1, css(p.sea));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const ox = w / 2 - cm.x * cm.k;
    const oy = h / 2 - cm.y * cm.k;
    ctx.setTransform(dpr * cm.k, 0, 0, dpr * cm.k, dpr * ox, dpr * oy);
    const px = 1 / cm.k; // one screen pixel in world units
    const [vx0, vy0] = [-ox / cm.k, -oy / cm.k];
    const [vx1, vy1] = [vx0 + w / cm.k, vy0 + h / cm.k];

    // map grid on the sea (video: white lines every 12 units)
    ctx.strokeStyle = css(p.grid);
    ctx.lineWidth = px;
    ctx.beginPath();
    for (let x = Math.floor(vx0 / 12) * 12; x <= vx1; x += 12) {
      ctx.moveTo(x, vy0);
      ctx.lineTo(x, vy1);
    }
    for (let zg = Math.floor(vy0 / PROJ.gy / 12) * 12; zg * PROJ.gy <= vy1; zg += 12) {
      ctx.moveTo(vx0, zg * PROJ.gy);
      ctx.lineTo(vx1, zg * PROJ.gy);
    }
    ctx.stroke();

    // sea route through the districts (video: red dashed line, grade by grade)
    ctx.strokeStyle = css(p.route);
    ctx.lineWidth = 1.6 * px;
    ctx.setLineDash([7 * px, 5 * px]);
    ctx.beginPath();
    T.route.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else {
        const [x0, y0] = T.route[i - 1];
        ctx.quadraticCurveTo(x0, y0, (x0 + x) / 2, (y0 + y) / 2);
        if (i === T.route.length - 1) ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // land and columns, back to front
    const sand = shades(p.sand, p, 0);
    const grass = shades(p.grass, p, 0);
    const grassHs = shades(p["grass-hs"], p, 0);
    const gap = css(p["sand-gap"]);
    const shadeCache = new Map<string, Shades>();
    const shadeFor = (key: string, base: () => RGBA) => {
      let s = shadeCache.get(key);
      if (!s) shadeCache.set(key, (s = shades(base(), p)));
      return s;
    };
    const poly = (pts: [number, number][]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    };
    const column = (x: number, z: number, hh: number, s: number, sh: Shades, cap: number | null, stroke: string | null) => {
      const [cx, cyTop] = project(x, z, hh);
      const [, cyBase] = project(x, z, 0);
      const top = hexCorners(cx, cyTop, s);
      if (cyBase - cyTop > 0.02) {
        const base = hexCorners(cx, cyBase, s);
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
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.07;
        ctx.stroke();
      }
      if (cap) {
        ctx.fillStyle = sh.cap;
        poly(hexCorners(cx, cyTop, cap));
        ctx.fill();
      }
    };
    for (const it of items) {
      if (it.x < vx0 - 2 || it.x > vx1 + 2) continue;
      const yb = it.z * PROJ.gy;
      if (yb < vy0 - 2 || yb > vy1 + 8) continue;
      if (it.kind === "land") {
        const l = it.l;
        const sh = l.ring === 2 ? sand : l.level === "高" ? grassHs : grass;
        column(l.x, l.z, l.ring === 1 ? 0.22 : 0.12, HEX.land, sh, null, gap);
      } else {
        const t = it.t;
        const u = T.byId.get(t.unitId)!;
        const st = status(t.unitId);
        const look = lookOf(st);
        const k = riseOf(t.unitId, now);
        let sh: Shades;
        if (k < 1) {
          // rising: colour comes in as it lifts (video: unexplored → strand)
          const to = look.fill === "gold" ? p.gold : p[COLOR_TOKEN[u.color]];
          sh = shades(mix(mix(p.unex, p[COLOR_TOKEN[u.color]], 0.14), to, Math.min(1, k * 1.6)), p);
        } else if (look.fill === "unex") sh = shadeFor(`u-${u.color}`, () => mix(p.unex, p[COLOR_TOKEN[u.color]], 0.14));
        else if (look.fill === "gold") sh = shadeFor("gold", () => p.gold);
        else sh = shadeFor(u.color, () => p[COLOR_TOKEN[u.color]]);
        column(t.x, t.z, heightOf(t, now), HEX.tile, sh, HEX.cap, t.unitId === selected ? css(p.white) : null);
      }
    }

    // root routes of the open unit: dashed sea lines to its roots on other islands
    if (selected && T.byId.has(selected)) {
      const a = T.byId.get(selected)!.anchor;
      const [ax, ay] = project(a.x, a.z, heightOf(a, now));
      ctx.strokeStyle = css(p.root);
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([6 * px, 5 * px]);
      for (const r of rootIds(selected)) {
        const b = T.byId.get(r)?.anchor;
        if (!b) continue;
        const [bx, by] = project(b.x, b.z, heightOf(b, now));
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
      ly.style.setProperty("--mk", String(Math.min(1, Math.max(0.42, cm.k / 16)) / cm.k));
      for (const el of ly.querySelectorAll<HTMLElement>("[data-unit]")) {
        const id = el.dataset.unit!;
        const a = T.byId.get(id)!.anchor;
        const [x, y] = project(a.x, a.z, heightOf(a, now));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
    }
    if (animating) frame.current = requestAnimationFrame(tick);
    // tick is stable; it always runs the latest draw (selection, states)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T, items, status, riseOf, heightOf, selected]);
  drawRef.current = draw;

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);
  useEffect(() => schedule(), [schedule, draw]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

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
        // the band between the brand pill and the open sheet (measured; the sheet is fixed to the window)
        const sheet = document.querySelector(".sheet");
        const wt = wrap.current?.getBoundingClientRect().top ?? 0;
        const bottom = sheet ? sheet.getBoundingClientRect().top - wt : v.h * 0.45;
        region = { x0: 16, y0: 110, x1: v.w - 16, y1: Math.max(160, Math.min(v.h, bottom) - 12) };
      }
      const curK = cam.current?.k ?? homeK;
      setCam(frameBox(b, v, T, { fill: where === "top" ? 0.8 : 0.62, region, maxK: Math.max(homeK * 1.25, curK) }), animate);
    },
    [T, grade, status, setCam],
  );

  useImperativeHandle(
    props.api,
    () => ({
      home: () => setCam(homeCam(T, grade, view.current), true),
      zoom: (f) => {
        // rapid taps build on where the camera is going, not where it is mid-flight
        const c = fly.current?.to ?? cam.current;
        if (c) setCam(zoomAt(c, view.current, f, view.current.w / 2, view.current.h / 2, T), true);
      },
      frameUnits: (ids, where) => frameUnits(ids, where),
    }),
    [T, grade, setCam, frameUnits],
  );

  // ---------- size, palette, first camera ----------
  const started = useRef(false);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    palette.current = readPalette(el);
    const measure = () => {
      const w = Math.max(200, el.clientWidth);
      const h = Math.max(200, el.clientHeight);
      view.current = { w, h };
      if (!started.current) {
        started.current = true;
        const home = homeCam(T, grade, view.current);
        if (lit.length > 0 && !reduceMotion()) {
          // after 保存: start a little further out, fly to the new tiles, then they rise
          cam.current = clampCam({ ...home, k: home.k * 0.7 }, T, view.current);
          rise.current = { ids: new Set(lit), start: performance.now() + FLY_MS };
          frameUnits(lit, "full");
        } else if (lit.length > 0) {
          cam.current = home;
          frameUnits(lit, "full", false);
        } else cam.current = home;
      } else if (cam.current) cam.current = clampCam(cam.current, T, view.current);
      schedule();
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
    // first camera only once; lit is read on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      cam.current = panBy(cam.current, v, dx, dy, T);
    } else if (ptrs.current.size === 2) {
      gesture.current.moved = true;
      ptrs.current.set(e.pointerId, cur);
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
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
        {T.islands.map((isl) => {
          // the video's district label: over the island, on the sand just above its tiles
          const hs = T.units.filter((u) => u.grade === isl.grade).flatMap((u) => u.hexes);
          const y = Math.min(...hs.map((t) => project(t.x, t.z - 1, t.h + HEIGHT.goldLift)[1])) - 0.15;
          const x = isl.x;
          return (
            <span
              key={isl.grade}
              className={`terr-isl${isl.grade === grade ? " is-own" : ""}`}
              style={{ left: `${x}px`, top: `${y}px` }}
              data-island={isl.grade}
              aria-hidden
            >
              {isl.grade}
            </span>
          );
        })}
        {tiles.map((t) => {
          const u = T.byId.get(t.unit.id);
          if (!u) return null;
          const look = lookOf(t.status);
          return (
            <button
              key={t.unit.id}
              type="button"
              className={`terr-unit st-${t.status}${litSet.has(t.unit.id) ? " is-lit" : ""}${selected === t.unit.id ? " is-sel" : ""}${pointed === t.unit.id ? " is-pointed" : ""}${selected && rootIds(selected).includes(t.unit.id) ? " is-root" : ""}${t.unit.appGrade === grade ? " is-own" : ""}`}
              data-unit={t.unit.id}
              data-status={t.status}
              aria-label={tileLabel(t)}
              aria-pressed={selected === t.unit.id}
              onClick={() => {
                if (gesture.current.moved) return;
                onSelect(selected === t.unit.id ? null : t.unit.id);
              }}
            >
              <span className="terr-mark" aria-hidden>
                {look.pulse && <span className="terr-pulse" />}
                {look.flag && (
                  <svg className="terr-flag" viewBox="0 0 20 30" width="20" height="30">
                    <path className="flag-pole" d="M5 29V3" />
                    <path className="flag-cloth" d="M5.5 3h11l-3 4.5 3 4.5h-11z" />
                    <circle className="flag-foot" cx="5" cy="29" r="1.6" />
                  </svg>
                )}
                {look.crown && (
                  <svg className="terr-crown" viewBox="0 0 24 24" width="22" height="22">
                    <path d="M12 2.5l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L12 15.2 6.9 18.4l1.4-5.9-4.6-3.9 6-.5z" />
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
