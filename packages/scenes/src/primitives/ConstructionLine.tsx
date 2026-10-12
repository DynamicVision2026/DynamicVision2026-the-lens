import { partialPolyline } from '../geometry';
import { dashArray, lensColor, type LensOrDirect, type RenderMode } from '../tokens';
import type { Point, StrokeToken, Tokens } from '../types';
import { svgPoints, type Frame } from './frame';

interface Props {
  frame: Frame;
  /** Path in lattice coordinates; repeat the first point to close a box. */
  path: Point[];
  lens: LensOrDirect;
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1 draw-on progress along the path. */
  t?: number;
  opacity?: number;
  stroke?: StrokeToken;
  color?: string;
}

/** An enclosing box, cut line or height, drawn on with t. Keeps the dashed token pattern while drawing. */
export function ConstructionLine({ frame, path, lens, tokens, mode, t = 1, opacity = 1, stroke, color: override }: Props) {
  if (t <= 0 || opacity <= 0) return null;
  const s = stroke ?? tokens.stroke.lens_construction;
  return (
    <polyline
      points={svgPoints(frame, partialPolyline(path, t))}
      fill="none"
      stroke={override ?? lensColor(tokens, lens, mode)}
      strokeWidth={s.width}
      strokeDasharray={dashArray(s.dash)}
      strokeLinecap={tokens.stroke.cap}
      strokeLinejoin={tokens.stroke.join}
      opacity={opacity}
    />
  );
}
