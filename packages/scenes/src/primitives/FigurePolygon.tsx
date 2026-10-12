import { outwardDirection } from '../geometry';
import { color, dashArray, fontFamily, fontSize, type RenderMode } from '../tokens';
import type { Point, Tokens } from '../types';
import { svgPoints, toSvg, type Frame } from './frame';

interface Props {
  frame: Frame;
  points: Point[];
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1 fade-in of the figure and its labels. */
  t?: number;
  /** Optional fill colour and opacity (the show_answer tint). */
  tint?: { color: string; opacity: number };
  /** Stroke and label colour override (the chalk trap state). Defaults to `color.ink`. */
  ink?: string;
  /** Stroke dash override, e.g. the trap dash for chalk. Defaults to `stroke.figure.dash`. */
  dash?: string;
  /** Draw the vertex letters (default true). The Short layout places its own. */
  showLabels?: boolean;
}

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The problem figure with vertex labels A, B, C… in point order. */
export function FigurePolygon({ frame, points, tokens, mode, t = 1, tint, ink: inkOverride, dash, showLabels = true }: Props) {
  const ink = inkOverride ?? color(tokens.color.ink, mode);
  const size = fontSize(tokens, 'label', mode);
  return (
    <g opacity={t}>
      <polygon
        points={svgPoints(frame, points)}
        fill={tint ? tint.color : 'none'}
        fillOpacity={tint ? tint.opacity : undefined}
        stroke={ink}
        strokeWidth={tokens.stroke.figure.width}
        strokeDasharray={dashArray(dash ?? tokens.stroke.figure.dash)}
        strokeLinejoin={tokens.stroke.join}
        strokeLinecap={tokens.stroke.cap}
      />
      {showLabels && points.map((p, i) => {
        const [x, y] = toSvg(frame, p);
        const [dx, dy] = outwardDirection(points, i);
        const off = size * 0.95;
        return (
          <text
            key={i}
            x={x + dx * off}
            y={y - dy * off}
            fill={ink}
            fontFamily={fontFamily(tokens, tokens.type.scale.label, 'family_num')}
            fontSize={size}
            fontWeight={tokens.type.scale.label.weight}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {LABELS[i] ?? String(i + 1)}
          </text>
        );
      })}
    </g>
  );
}
