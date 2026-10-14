// 囲む: drag the box's corners until they snap onto the shape; then the corner triangles appear,
// each with its value from the step (positions from step.detail, never recomputed). WO-020: the same
// gesture on a coordinate plane (coord_polygon), and as stage 2 of the chain on △ABP (coord_mirror_area).
import { counterClockwise, enclosureGaps, formatExact, mirrorAreaP, stageSteps, type CoordMirrorAreaFigure, type CoordPolygonFigure, type GridPolygonFigure, type LensCard, type Point, type Step } from '@lens/scenes';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { coordLabel, CoordPlane, labelAt, plane, type Plane } from './coordkit';
import { C, clamp, CountableGrid, Knob, SceneLock, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;
const LETTERS = 'ABCDEFGHIJ';

interface EncloseView {
  pts: Point[];
  names: string[];
  /** Corner triangles and their printed values (from the steps). */
  corners: { tri: Point[]; value: string }[];
  /** The box may move within [lo, hi] on each axis. */
  lo: Point;
  hi: Point;
  X: (x: number) => number;
  Y: (y: number) => number;
  gx: (px: number) => number;
  gy: (py: number) => number;
  s: number;
  /** The grid as before, or the coordinate plane. */
  plane: Plane | null;
  gw: number;
  gh: number;
}

/** Twice the signed area (shoelace), to tell which step belongs to which corner (matching only; nothing printed). */
const area2 = (t: Point[]) => Math.abs(t.reduce((a, p, i) => a + p[0] * t[(i + 1) % t.length]![1] - t[(i + 1) % t.length]![0] * p[1], 0));
const stepValue = (st: Step) => {
  const [n, d] = (st.value ?? '').split('/');
  return Number(n) / (d ? Number(d) : 1);
};

/** Corner triangles from the steps' detail (edge + corner point), or, without detail, the enclosure gaps matched to the steps by value. */
function cornersOf(steps: Step[], pts: Point[], names: string[]): EncloseView['corners'] {
  const subs = steps.filter((st) => st.op === 'sub');
  if (subs.every((st) => st.detail?.kind === 'corner')) {
    return subs.map((st) => {
      const d = st.detail as { edge: string; corner: Point };
      const a = pts[names.indexOf(d.edge[0]!)]!;
      const b = pts[names.indexOf(d.edge[1]!)]!;
      return { tri: [a, b, d.corner] as Point[], value: formatExact(st.value ?? '') };
    });
  }
  const left = [...subs];
  return enclosureGaps(pts).map((tri) => {
    const i = left.findIndex((st) => Math.abs(stepValue(st) * 2 - area2(tri)) < 1e-6);
    const st = i >= 0 ? left.splice(i, 1)[0] : undefined;
    return { tri, value: st ? formatExact(st.value ?? '') : '' };
  });
}

function encloseView(card: LensCard, steps: Step[]): EncloseView {
  const fig = card.problem.figure;
  if (fig.type === 'coord_polygon' || fig.type === 'coord_mirror_area') {
    const m = fig.type === 'coord_mirror_area' ? (fig as CoordMirrorAreaFigure) : null;
    // △ABP counter-clockwise (A → P → B), as enclosureGaps expects.
    const tri: [string, Point][] = m ? [['A', m.A], ['P', mirrorAreaP(card, m)], ['B', m.B]] : [];
    const raw = tri.map(([, q]) => q);
    const ccw = m && counterClockwise(raw) !== raw ? [...tri].reverse() : tri;
    const pts: Point[] = m ? ccw.map(([, q]) => q) : (fig as CoordPolygonFigure).points;
    const names = m ? ccw.map(([n]) => n) : LETTERS.slice(0, pts.length).split('');
    // Stage 2 of the chain keeps stage 1's plane (B′ below the axis), so the figure doesn't jump.
    const P = plane(m ? [...pts, [m.B[0], -m.B[1]]] : pts);
    return { pts, names, corners: cornersOf(steps, pts, names), lo: [P.x0, P.y0], hi: [P.x1, P.y1], X: P.X, Y: P.Y, gx: P.ux, gy: P.uy, s: P.s, plane: P, gw: P.x1 - P.x0, gh: P.y1 - P.y0 };
  }
  const g = fig as GridPolygonFigure;
  const { width: gw, height: gh } = g.grid;
  const s = Math.min(470 / (gw + 3), 350 / (gh + 3));
  const ox = (W - gw * s) / 2;
  const oy = (H + gh * s) / 2 - 6;
  const names = LETTERS.slice(0, g.points.length).split('');
  return {
    pts: g.points,
    names,
    corners: cornersOf(steps, g.points, names),
    lo: [-0.5, -0.5],
    hi: [gw + 0.5, gh + 0.5],
    X: (x) => ox + x * s,
    Y: (y) => oy - y * s,
    gx: (px) => (px - ox) / s,
    gy: (py) => (oy - py) / s,
    s,
    plane: null,
    gw,
    gh,
  };
}

export function EncloseScene({ card, lens, onSolved, stage }: SceneProps) {
  const steps = stage?.steps ?? stageSteps(card, null);
  const view = useMemo(() => encloseView(card, steps), [card, steps]);
  const { pts, X, Y, gx, gy, s, gw, gh } = view;
  const unit = card.problem.unit.replace('²', '');
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const target = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const locked = useContext(SceneLock);
  const cx0 = (target.x0 + target.x1) / 2;
  const cy0 = (target.y0 + target.y1) / 2;
  const [box, setBox] = useState({ x0: cx0 - 0.8, y0: cy0 - 0.8, x1: cx0 + 0.8, y1: cy0 + 0.8 });
  const boxRef = useRef(box);
  boxRef.current = box;
  const [done, setDone] = useState(false);
  const [shown, setShown] = useState(0);

  const corners = view.corners;

  useEffect(() => {
    guide.coach({
      phase: 'box',
      text: t('guide.enclose.box'),
      svg,
      from: () => [X(boxRef.current.x0), Y(boxRef.current.y1)],
      to: () => [X(boxRef.current.x0 + (target.x0 - boxRef.current.x0) * 0.6), Y(boxRef.current.y1 + (target.y1 - boxRef.current.y1) * 0.6)],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  useEffect(() => {
    if (!done) return;
    const timers = corners.map((_, i) =>
      window.setTimeout(() => {
        setShown(i + 1);
        sfx.tap();
      }, 250 + i * 420),
    );
    timers.push(window.setTimeout(onSolved, 400 + corners.length * 420));
    return () => timers.forEach(window.clearTimeout);
  }, [done, corners, onSolved]);

  const snapAll = () => {
    const lim = { x0: [view.lo[0], view.hi[0]], x1: [view.lo[0], view.hi[0]], y0: [view.lo[1], view.hi[1]], y1: [view.lo[1], view.hi[1]] } as const;
    const snapped = { ...boxRef.current };
    (Object.keys(lim) as (keyof typeof lim)[]).forEach((k) => {
      const to = clamp(Math.round(boxRef.current[k]), Math.ceil(lim[k][0]), Math.floor(lim[k][1]));
      snapped[k] = to;
      springTo(`enclose-${k}`, boxRef.current[k], to, (v) => setBox((b) => ({ ...b, [k]: v })), TACTILE.snap);
    });
    window.setTimeout(() => {
      const [a, b] = [Math.min(snapped.x0, snapped.x1), Math.max(snapped.x0, snapped.x1)];
      const [c, d] = [Math.min(snapped.y0, snapped.y1), Math.max(snapped.y0, snapped.y1)];
      if (a === target.x0 && b === target.x1 && c === target.y0 && d === target.y1) {
        sfx.snap();
        setDone(true);
      } else if (Math.abs(snapped.x1 - snapped.x0) > 1.5) guide.say(t('guide.enclose.retry'));
    }, 380);
  };

  const handle = (kx: 'x0' | 'x1', ky: 'y0' | 'y1') =>
    drag({
      move: (p) => {
        if (done) return;
        setBox((b) => ({ ...b, [kx]: clamp(gx(p.x), view.lo[0], view.hi[0]), [ky]: clamp(gy(p.y), view.lo[1], view.hi[1]) }));
      },
      end: () => {
        if (!done) snapAll();
      },
    });

  const centroid = pts.reduce((acc, p) => [acc[0] + p[0] / pts.length, acc[1] + p[1] / pts.length], [0, 0]);
  const bx = Math.min(box.x0, box.x1);
  const by = Math.max(box.y0, box.y1);

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-enclose">
      <StripeDefs />
      {view.plane ? <CoordPlane P={view.plane} /> : <CountableGrid X={X} Y={Y} w={gw} h={gh} unit={unit} />}
      <g>
        {corners.slice(0, shown).map(({ tri, value }, i) => {
          const mx = (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3;
          const my = (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3;
          return (
            <g key={i} className="appear">
              <polygon points={tri.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill={`url(#st${i % 4})`} stroke={C.palette[i % 4]} strokeWidth={2} />
              <Txt x={X(mx)} y={Y(my) + 7} size={22} fill={C.palette[i % 4]}>
                {value}
              </Txt>
            </g>
          );
        })}
      </g>
      <polygon points={pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill={C.ink} fillOpacity={0.07} stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const name = view.names[i]!;
        // On the plane: coordinates for given points, clear of the axes and ticks; P (found in stage 1) by name.
        if (view.plane) {
          const text = name !== 'P' ? coordLabel(name, p) : name;
          const at = labelAt(view.plane, p, centroid as Point, text);
          return (
            <Txt key={i} x={at.x} y={at.y} size={14} anchor={at.anchor} fill={C.quiet}>
              {text}
            </Txt>
          );
        }
        const dx = p[0] - centroid[0]!;
        const dy = p[1] - centroid[1]!;
        const d = Math.hypot(dx, dy) || 1;
        return (
          <Txt key={i} x={X(p[0]) + (dx / d) * 20} y={Y(p[1]) - (dy / d) * 20 + 6} size={16} fill={C.quiet}>
            {name}
          </Txt>
        );
      })}
      {!locked && <rect x={X(bx)} y={Y(by)} width={Math.abs(box.x1 - box.x0) * s} height={Math.abs(box.y1 - box.y0) * s} fill="none" stroke={color} strokeWidth={3} strokeDasharray={done ? undefined : '10 7'} rx={2} />}
      {!done && (
        <>
          <Knob x={X(box.x0)} y={Y(box.y1)} fill={color} onDown={handle('x0', 'y1')} />
          <Knob x={X(box.x1)} y={Y(box.y0)} fill={color} onDown={handle('x1', 'y0')} />
        </>
      )}
    </svg>
  );
}
