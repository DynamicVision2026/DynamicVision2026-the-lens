// 囲む: drag the box's corners until they snap onto the shape; then the corner triangles appear,
// each with its value from the step (positions from step.detail, never recomputed).
import { formatExact, type GridPolygonFigure, type Point } from '@lens/scenes';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, CountableGrid, Knob, SceneLock, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;
const LETTERS = 'ABCDEFGHIJ';

export function EncloseScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as GridPolygonFigure;
  const { width: gw, height: gh } = fig.grid;
  const unit = card.problem.unit.replace('²', '');
  const pts = fig.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const target = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const s = Math.min(470 / (gw + 3), 350 / (gh + 3));
  const ox = (W - gw * s) / 2;
  const oy = (H + gh * s) / 2 - 6;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy - y * s;
  const gx = (px: number) => (px - ox) / s;
  const gy = (py: number) => (oy - py) / s;
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

  // Corner triangles from the steps: the edge's two vertices plus the step's corner point.
  const corners = useMemo(
    () =>
      card.lens_route.steps
        .filter((st) => st.op === 'sub' && st.detail?.kind === 'corner')
        .map((st) => {
          const d = st.detail as { edge: string; corner: Point };
          const a = pts[LETTERS.indexOf(d.edge[0]!)]!;
          const b = pts[LETTERS.indexOf(d.edge[1]!)]!;
          return { tri: [a, b, d.corner] as Point[], value: formatExact(st.value ?? '') };
        }),
    [card, pts],
  );

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
    const lim = { x0: gw, x1: gw, y0: gh, y1: gh } as const;
    const snapped = { ...boxRef.current };
    (Object.keys(lim) as (keyof typeof lim)[]).forEach((k) => {
      const to = clamp(Math.round(boxRef.current[k]), 0, lim[k]);
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
        setBox((b) => ({ ...b, [kx]: clamp(gx(p.x), -0.5, gw + 0.5), [ky]: clamp(gy(p.y), -0.5, gh + 0.5) }));
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
      <CountableGrid X={X} Y={Y} w={gw} h={gh} unit={unit} />
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
        const dx = p[0] - centroid[0]!;
        const dy = p[1] - centroid[1]!;
        const d = Math.hypot(dx, dy) || 1;
        return (
          <Txt key={i} x={X(p[0]) + (dx / d) * 20} y={Y(p[1]) - (dy / d) * 20 + 6} size={16} fill={C.quiet}>
            {LETTERS[i]}
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
