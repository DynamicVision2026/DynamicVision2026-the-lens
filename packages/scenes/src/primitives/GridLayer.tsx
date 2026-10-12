import { color, dashArray, type RenderMode } from '../tokens';
import type { Tokens } from '../types';
import type { Frame } from './frame';

interface Props {
  frame: Frame;
  tokens: Tokens;
  mode?: RenderMode;
}

/** Grid lines for `figure.grid`; every `stroke.grid_major.every` line is a major line. */
export function GridLayer({ frame, tokens, mode }: Props) {
  const { grid, cell, left, top } = frame;
  const every = tokens.stroke.grid_major.every ?? 0;
  const stroke = color(tokens.color.grid, mode);
  const line = (i: number) => (every > 0 && i % every === 0 ? tokens.stroke.grid_major : tokens.stroke.grid);
  const right = left + grid.width * cell;
  const bottom = top + grid.height * cell;
  return (
    <g stroke={stroke} strokeLinecap={tokens.stroke.cap} fill="none">
      {Array.from({ length: grid.width + 1 }, (_, i) => {
        const x = left + i * cell;
        const s = line(i);
        return <line key={`x${i}`} x1={x} y1={top} x2={x} y2={bottom} strokeWidth={s.width} strokeDasharray={dashArray(s.dash)} />;
      })}
      {Array.from({ length: grid.height + 1 }, (_, i) => {
        const y = bottom - i * cell;
        const s = line(i);
        return <line key={`y${i}`} x1={left} y1={y} x2={right} y2={y} strokeWidth={s.width} strokeDasharray={dashArray(s.dash)} />;
      })}
    </g>
  );
}
