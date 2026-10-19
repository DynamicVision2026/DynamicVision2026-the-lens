import { GROUND, PROJ, type Territory, hexCorners, project } from "../lib/territory";
import type { Deco, Seg } from "../lib/terrain";

/** RGBA from a token (the values live in theme/tokens.css only). */
export type RGBA = [number, number, number, number];
export type Palette = Record<string, RGBA>;
export const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
export const css = (c: RGBA) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;

/** Terrain tokens the painter reads (`--terr-<name>`). */
export const TERRAIN_TOKENS = [
  "sky", "sea", "sea-haze", "shallow", "shore", "grid", "contour", "coast-edge", "border", "trail", "trail-casing",
  "water", "water-line", "canopy", "canopy-deep", "canopy-hi", "hachure", "stipple", "tuft", "snow-mark", "crevasse", "peak", "red",
  "g-sand", "g-grass", "g-forest", "g-deep", "g-moss", "g-rock", "g-alpine", "g-scree", "g-ice", "g-snow", "white", "black",
] as const;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Paint the continent (everything under the tiles) in world units: sea → sky backdrop, shoreline
 * contours, land columns (terraced, lighter with height), contour lines, zone borders, the lake and
 * river, a faint survey grid, map-style surface marks and the trail. `px` = one screen pixel in world
 * units. Drawn once per zoom into an offscreen canvas (TerritoryMap), not every frame.
 */
export function paintTerrain(ctx: CanvasRenderingContext2D, T: Territory, p: Palette, r: Rect, px: number) {
  const tr = T.terrain;
  const inView = (x: number, y: number, m = 3) => x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m * 2;
  // backdrop: open sea at the coast (front), hazing into pale sky behind the summit
  const g = ctx.createLinearGradient(0, T.box.y0 - 8, 0, T.box.y1);
  g.addColorStop(0, css(p.sky));
  g.addColorStop(0.42, css(p["sea-haze"]));
  g.addColorStop(0.8, css(p.sea));
  g.addColorStop(1, css(p.sea));
  ctx.fillStyle = g;
  ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);

  const poly = (pts: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  const segs = (list: Seg[], color: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of list) {
      if (!inView(x0, y0)) continue;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // shallows (小1・小2 coast), then shoreline contours fading out to sea
  ctx.fillStyle = css(p.shallow);
  ctx.strokeStyle = css(p.shallow);
  ctx.lineWidth = px;
  for (const [x, z] of tr.shallow) {
    const [cx, cy] = project(x, z, 0);
    if (!inView(cx, cy)) continue;
    poly(hexCorners(cx, cy, 1));
    ctx.fill();
    ctx.stroke();
  }
  const shore = p.shore;
  tr.shore.forEach((list, i) => segs(list, css([shore[0], shore[1], shore[2], shore[3] * [1, 0.6, 0.32][i]]), px * (i === 0 ? 1.2 : 1)));

  // land columns, back to front: top face in the zone's ground tone (lighter with height), two side faces
  const shadeCache = new Map<string, { top: string; left: string; right: string }>();
  const shadeOf = (ground: string, e: number, water: boolean) => {
    const k = `${ground}|${e}|${water}`;
    let s = shadeCache.get(k);
    if (!s) {
      const base = water ? p.water : p[`g-${ground}`];
      const top = mix(base, p.white, Math.min(0.22, e * 0.035));
      s = { top: css(top), left: css(mix(base, p.black, 0.16)), right: css(mix(base, p.black, 0.3)) };
      shadeCache.set(k, s);
    }
    return s;
  };
  const land = [...tr.land].sort((a, b) => a.z - b.z || a.x - b.x);
  ctx.lineJoin = "round";
  for (const c of land) {
    const [cx, cyTop] = project(c.x, c.z, c.e);
    if (!inView(cx, cyTop, 4)) continue;
    const [, cyBase] = project(c.x, c.z, 0);
    const s = shadeOf(GROUND[c.zone], c.e, c.water);
    const top = hexCorners(cx, cyTop, 1);
    if (cyBase - cyTop > 0.01) {
      const base = hexCorners(cx, cyBase, 1);
      ctx.fillStyle = s.left;
      poly([top[3], top[4], base[4], base[3]]);
      ctx.fill();
      ctx.fillStyle = s.right;
      poly([top[2], top[3], base[3], base[2]]);
      ctx.fill();
    }
    ctx.fillStyle = s.top;
    ctx.strokeStyle = s.top; // hides hairline seams between neighbouring hexes
    ctx.lineWidth = px;
    poly(top);
    ctx.fill();
    ctx.stroke();
  }

  // lines on the land: coastline, terrace contours, lake shore, zone borders
  segs(tr.coastline, css(p["coast-edge"]), px * 1.2);
  segs(tr.contours, css(p.contour), px);
  segs(tr.lakeShore, css(p["water-line"]), px * 1.2);
  segs(tr.borders, css(p.border), px, [px * 2, px * 3]);

  // survey grid over everything (every 6 units)
  ctx.strokeStyle = css(p.grid);
  ctx.lineWidth = px;
  ctx.beginPath();
  for (let x = Math.floor(r.x0 / 6) * 6; x <= r.x1; x += 6) {
    ctx.moveTo(x, r.y0);
    ctx.lineTo(x, r.y1);
  }
  for (let y = Math.floor(r.y0 / (6 * PROJ.gy)) * 6 * PROJ.gy; y <= r.y1; y += 6 * PROJ.gy) {
    ctx.moveTo(r.x0, y);
    ctx.lineTo(r.x1, y);
  }
  ctx.stroke();

  // river from the lake to the coast
  if (tr.river.length > 1) {
    ctx.strokeStyle = css(p["water-line"]);
    ctx.lineWidth = Math.max(px * 1.6, 0.14);
    ctx.lineCap = "round";
    smooth(ctx, tr.river);
    ctx.stroke();
  }

  // surface marks
  for (const d of tr.decos) {
    const [x, y] = project(d.x, d.z, d.e);
    if (!inView(x, y)) continue;
    paintDeco(ctx, d, x, y, p, px);
  }

  // the trail: dark casing + light dashes, coast → summit
  if (tr.trail.length > 1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = css(p["trail-casing"]);
    ctx.lineWidth = px * 3.6;
    smooth(ctx, tr.trail);
    ctx.stroke();
    ctx.strokeStyle = css(p.trail);
    ctx.lineWidth = px * 1.7;
    ctx.setLineDash([px * 6, px * 5]);
    smooth(ctx, tr.trail);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** A polyline through cell centres, rounded at the corners (quadratic through the midpoints). */
function smooth(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const [lx, ly] = pts[pts.length - 1];
  ctx.lineTo(lx, ly);
}

/** Small deterministic offsets from a mark's seed. */
const jit = (a: number, i: number) => {
  const v = Math.sin((a * 9301 + i * 49297) % 233280) * 43758.5453;
  return v - Math.floor(v) - 0.5;
};

/** One surface mark, inside decoBox(d) (see terrain.ts LIFT): map symbols seen from above, nothing cute. */
function paintDeco(ctx: CanvasRenderingContext2D, d: Deco, x: number, y: number, p: Palette, px: number) {
  const s = d.s;
  const gy = PROJ.gy;
  switch (d.kind) {
    case "stipple": {
      ctx.fillStyle = css(p.stipple);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(x + jit(d.a, i) * s * 1.3, y + jit(d.a, i + 7) * s * gy * 1.3, Math.max(0.045, px * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "tuft": {
      // grassland symbol: three short ticks
      ctx.strokeStyle = css(p.tuft);
      ctx.lineWidth = Math.max(px, 0.05);
      ctx.beginPath();
      for (const o of [-0.16, 0, 0.16]) {
        const h = o === 0 ? 0.12 : 0.08;
        ctx.moveTo(x + o, y + 0.04);
        ctx.lineTo(x + o * 1.2, y + 0.04 - h);
      }
      ctx.stroke();
      break;
    }
    case "canopy":
    case "canopyDense": {
      // tree crowns from above: dark dots with a sunlit edge (light from the upper left)
      const n = d.kind === "canopy" ? 5 : 8;
      const rr = d.kind === "canopy" ? 0.14 : 0.13;
      const body = css(d.kind === "canopy" ? p.canopy : p["canopy-deep"]);
      const hi = css(p["canopy-hi"]);
      for (let i = 0; i < n; i++) {
        const ox = jit(d.a, i) * 0.8;
        const oy = jit(d.a, i + 11) * 0.5 - 0.12;
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hi;
        ctx.beginPath();
        ctx.arc(x + ox - rr * 0.3, y + oy - rr * 0.3, rr * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "hachure": {
      // rock hachures: short parallel strokes down the slope
      ctx.strokeStyle = css(p.hachure);
      ctx.lineWidth = Math.max(px, 0.045);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ox = -0.3 + i * 0.2;
        ctx.moveTo(x + ox, y - 0.16);
        ctx.lineTo(x + ox + 0.1, y + 0.18);
      }
      ctx.stroke();
      break;
    }
    case "snow": {
      ctx.fillStyle = css(p["snow-mark"]);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const k = 0.3 + (jit(d.a, i) + 0.5) * 0.18;
        const px2 = x + Math.cos(a) * k;
        const py2 = y + Math.sin(a) * k * gy;
        if (i === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "crevasse": {
      // glacier cracks: one or two thin jagged lines across the flow
      ctx.strokeStyle = css(p.crevasse);
      ctx.lineWidth = Math.max(px * 0.9, 0.035);
      ctx.beginPath();
      const n = d.a < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const oy = (i - (n - 1) / 2) * 0.2 + jit(d.a, i) * 0.08;
        const sl = 0.12 + jit(d.a, i + 3) * 0.1;
        ctx.moveTo(x - 0.42, y + oy + sl);
        ctx.lineTo(x - 0.12, y + oy + sl * 0.2 + 0.04);
        ctx.lineTo(x + 0.08, y + oy - sl * 0.3);
        ctx.lineTo(x + 0.4, y + oy - sl);
      }
      ctx.stroke();
      break;
    }
    case "pass": {
      // map symbol for a mountain pass: two arcs back to back
      ctx.strokeStyle = css(p.peak);
      ctx.lineWidth = Math.max(px * 1.6, 0.08);
      ctx.beginPath();
      ctx.arc(x - 0.62, y, 0.4, -Math.PI / 3.2, Math.PI / 3.2);
      ctx.moveTo(x + 0.62 + Math.cos(Math.PI - Math.PI / 3.2) * 0.4, y + Math.sin(Math.PI - Math.PI / 3.2) * 0.4);
      ctx.arc(x + 0.62, y, 0.4, Math.PI - Math.PI / 3.2, Math.PI + Math.PI / 3.2);
      ctx.stroke();
      break;
    }
    case "peak": {
      // summit: a sharp triangle marker and a flag on a thin pole
      ctx.fillStyle = css(p.peak);
      ctx.strokeStyle = css(p.white);
      ctx.lineWidth = Math.max(px * 1.4, 0.06);
      ctx.beginPath();
      ctx.moveTo(x, y - 0.95);
      ctx.lineTo(x + 0.5, y + 0.12);
      ctx.lineTo(x - 0.5, y + 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = css(p.peak);
      ctx.lineWidth = Math.max(px * 1.2, 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y - 0.95);
      ctx.lineTo(x, y - 2.1);
      ctx.stroke();
      ctx.fillStyle = css(p.red);
      ctx.beginPath();
      ctx.moveTo(x, y - 2.1);
      ctx.lineTo(x + 0.62, y - 1.88);
      ctx.lineTo(x, y - 1.66);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}
