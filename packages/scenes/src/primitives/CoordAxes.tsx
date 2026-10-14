import { outwardDirection } from '../geometry';
import { color, fontFamily, fontSize, type RenderMode } from '../tokens';
import type { Point, Tokens } from '../types';
import { toSvg, type Frame } from './frame';

const COPY = { x: 'x', y: 'y', O: 'O' } as const;

interface Props {
  frame: Frame;
  /** The origin in grid units. */
  origin: Point;
  tokens: Tokens;
  mode?: RenderMode;
  t?: number;
  /** Vertex labels with coordinates (「A(−2, 0)」), placed outside `points` (grid units). */
  labels?: string[];
  points?: Point[];
  /** Ticks every n cells; by default 1, or 2 when the cells are small. */
  every?: number;
  /** Draw the axis lines (under the figure) or the numbers and labels (over it); both by default. */
  part?: 'lines' | 'labels';
}

/**
 * WO-020: x/y axes through the origin with tick numbers, O, and the vertices' coordinate labels. Tick
 * numbers are the axes' scale (marked data-tick), not values of the problem.
 */
export function CoordAxes({ frame, origin, tokens, mode, t = 1, labels, points, every, part }: Props) {
  const ink = color(tokens.color.ink, mode);
  const quiet = color(tokens.color.ink_quiet, mode);
  const size = fontSize(tokens, 'label', mode);
  const small = size * 0.72;
  const font = fontFamily(tokens, tokens.type.scale.label, 'family_num');
  const { grid } = frame;
  const [ox, oy] = toSvg(frame, origin);
  const [left, top] = toSvg(frame, [0, grid.height]);
  const [right, bottom] = toSvg(frame, [grid.width, 0]);
  const step = every ?? (frame.cell < small * 1.9 ? 2 : 1);
  const n = (v: number) => (v < 0 ? `−${-v}` : String(v));
  const arrow = (x: number, y: number, dx: number, dy: number) => {
    const a = size * 0.35;
    return `M ${x - dx * a - dy * a * 0.6} ${y - dy * a + dx * a * 0.6} L ${x} ${y} L ${x - dx * a + dy * a * 0.6} ${y - dy * a - dx * a * 0.6}`;
  };
  // Tick numbers inside the grid's edges, never under a vertex that sits on an axis (its own label says where it is).
  const onX = new Set((points ?? []).filter((p) => p[1] === origin[1]).map((p) => p[0] - origin[0]));
  const onY = new Set((points ?? []).filter((p) => p[0] === origin[0]).map((p) => p[1] - origin[1]));
  const xs = Array.from({ length: grid.width - 1 }, (_, i) => i + 1 - origin[0]).filter((v) => v !== 0 && v % step === 0 && !onX.has(v));
  const ys = Array.from({ length: grid.height - 1 }, (_, i) => i + 1 - origin[1]).filter((v) => v !== 0 && v % step === 0 && !onY.has(v));
  const lines = part !== 'labels';
  const numbers = part !== 'lines';
  return (
    <g opacity={t}>
      {lines && (
        <g stroke={ink} strokeWidth={tokens.stroke.figure.width * 0.9} fill="none" strokeLinecap="round">
          <line x1={left} y1={oy} x2={right} y2={oy} />
          <line x1={ox} y1={bottom} x2={ox} y2={top} />
          <path d={arrow(right, oy, 1, 0)} />
          <path d={arrow(ox, top, 0, -1)} />
        </g>
      )}
      {numbers && (
        <g fill={quiet} fontFamily={font} fontSize={small} textAnchor="middle" dominantBaseline="central">
          {xs.map((v) => (
            <text key={`x${v}`} data-tick="" x={ox + v * frame.cell} y={oy + small * 0.95}>
              {n(v)}
            </text>
          ))}
          {ys.map((v) => (
            <text key={`y${v}`} data-tick="" x={ox - small * 0.95} y={oy - v * frame.cell}>
              {n(v)}
            </text>
          ))}
        </g>
      )}
      {numbers && (
        <g fill={ink} fontFamily={font} fontSize={size} fontStyle="italic" dominantBaseline="central">
          <text x={right - size * 0.2} y={oy + size * 0.8} textAnchor="end">
            {COPY.x}
          </text>
          <text x={ox + size * 0.55} y={top + size * 0.3}>
            {COPY.y}
          </text>
          <text x={ox - size * 0.6} y={oy + size * 0.75} textAnchor="middle" fontStyle="normal">
            {COPY.O}
          </text>
        </g>
      )}
      {numbers && labels && points && (
        <g fill={ink} fontFamily={font} fontSize={size * 0.85} fontWeight={tokens.type.scale.label.weight} textAnchor="middle" dominantBaseline="central">
          {points.map((p, i) => {
            const [x, y] = toSvg(frame, p);
            const [dx, dy] = outwardDirection(points, i);
            const off = size * 1.6;
            // A vertex on an axis keeps its label off that axis's tick numbers.
            const lx = x + dx * off + (p[0] === origin[0] ? size * 1.4 : 0);
            const ly = y - dy * off * 0.7 - (p[1] === origin[1] ? size * 0.9 : 0);
            return (
              <text key={i} x={lx} y={ly}>
                {labels[i] ?? ''}
              </text>
            );
          })}
        </g>
      )}
    </g>
  );
}
