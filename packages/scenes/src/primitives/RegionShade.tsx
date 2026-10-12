import { lensColor, type LensOrDirect, type RenderMode } from '../tokens';
import type { Point, Tokens } from '../types';
import { svgPoints, type Frame } from './frame';

interface Props {
  frame: Frame;
  points: Point[];
  lens: LensOrDirect;
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1 fade-in to `color.lens_tint_opacity`. */
  t?: number;
  /** Overrides for the flag pulse: a different colour and a multiple of the tint opacity. */
  color?: string;
  strength?: number;
}

/** A filled region (corner triangle, piece) fading in with t. */
export function RegionShade({ frame, points, lens, tokens, mode, t = 1, color, strength = 1 }: Props) {
  if (t <= 0) return null;
  return (
    <polygon
      points={svgPoints(frame, points)}
      fill={color ?? lensColor(tokens, lens, mode)}
      fillOpacity={tokens.color.lens_tint_opacity * strength * t}
      stroke="none"
    />
  );
}
