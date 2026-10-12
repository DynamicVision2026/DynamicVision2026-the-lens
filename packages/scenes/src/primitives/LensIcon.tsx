import { lensColor, type LensOrDirect, type RenderMode } from '../tokens';
import type { Tokens } from '../types';

interface Props {
  lens: LensOrDirect;
  tokens: Tokens;
  mode?: RenderMode;
  x?: number;
  y?: number;
  size?: number;
}

/** Simple 24×24 line drawings keyed by the icon name in `color.lens.<lens>.icon`. */
const ICONS: Record<string, string[]> = {
  'square-dashed': ['M4 4h16v16H4z', 'M9 15l6-6'],
  'arrows-parallel': ['M4 8h14', 'M15 5l3 3-3 3', 'M4 16h14', 'M15 13l3 3-3 3'],
  'cube-unfolded': ['M9 3h6v6H9z', 'M3 9h18v6H3z', 'M9 15h6v6H9z', 'M9 9v6', 'M15 9v6'],
  snowflake: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M4.2 16.5l15.6-9'],
  seesaw: ['M3 15l18-6', 'M12 12l-3 8h6z'],
  rectangles: ['M3 6h10v12H3z', 'M13 10h8v8h-8z'],
  'mirror-axis': ['M12 3v18', 'M9 7l-5 5 5 5z', 'M15 7l5 5-5 5z'],
  'equals-lock': ['M5 9h14', 'M5 15h14', 'M8 5v-1a4 4 0 0 1 8 0v1'],
  pencil: ['M4 20l1-5L16 4l4 4L9 19z', 'M14 6l4 4'],
};

export function LensIcon({ lens, tokens, mode, x = 0, y = 0, size = 24 }: Props) {
  const paths = ICONS[tokens.color.lens[lens].icon] ?? ICONS['square-dashed']!;
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={lensColor(tokens, lens, mode)} strokeWidth={(tokens.stroke.lens.width * 24) / size} strokeLinecap={tokens.stroke.cap} strokeLinejoin={tokens.stroke.join}>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}
