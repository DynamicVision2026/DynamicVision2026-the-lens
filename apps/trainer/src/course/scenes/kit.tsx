// Shared pieces of the course player's interactive figures: theme colours, drag knobs, labels,
// the countable grid, and a pointer-drag hook in SVG coordinates.
import { color, cssVars, lensColor, themed, tokens, type LensOrDirect } from '@lens/scenes';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject, type SVGProps } from 'react';
import { sfx, stopSprings, TACTILE } from '../fx';
import { useGuide, type GuideApi } from '../guide';

/** The course player's palette: the dark theme, which tokens 1.6 makes official for /pass and /lesson. */
const dark = themed(tokens, 'short_dark').tokens;
const opt = (c: typeof dark.color.panel, fallback: typeof dark.color.paper) => color(c ?? fallback);
export const C = {
  paper: color(dark.color.paper),
  panel: opt(dark.color.panel, dark.color.paper),
  raise: opt(dark.color.raise, dark.color.paper),
  line: opt(dark.color.line, dark.color.ink_quiet),
  gridMinor: opt(dark.color.grid_minor, dark.color.ink_quiet),
  gridMajor: opt(dark.color.grid_major, dark.color.ink),
  ink: color(dark.color.ink),
  quiet: color(dark.color.ink_quiet),
  flag: color(dark.color.trap.flag),
  palette: dark.color.step.palette.map((p) => color(p)),
  tint: dark.color.step.tint_opacity,
  lens: (lens: string) => lensColor(dark, lens as LensOrDirect),
  font: `"${dark.type.family_ja}", sans-serif`,
  num: `"${dark.type.family_num}", sans-serif`,
  weight: dark.type.scale.title.weight,
};

/**
 * While a course page is mounted, the page's CSS variables take the dark theme's token values
 * (and the step palette), then go back to the base theme on leaving.
 */
export function useCourseTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = { ...cssVars(dark) };
    C.palette.forEach((c, i) => (vars[`--s${i}`] = c));
    vars['--flag'] = C.flag;
    vars['--panel'] = C.panel;
    vars['--raise'] = C.raise;
    vars['--line'] = C.line;
    vars['--halo-ms'] = `${TACTILE.haloMs}ms`;
    vars['--halo-repeats'] = String(TACTILE.haloRepeats);
    const before = Object.fromEntries(Object.keys(vars).map((k) => [k, root.style.getPropertyValue(k)]));
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.theme = 'course';
    return () => {
      for (const [k, v] of Object.entries(before)) {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      }
      delete root.dataset.theme;
    };
  }, []);
}

export interface SceneProps {
  /** The problem (a card, or a variant as a card). */
  card: import('@lens/scenes').LensCard;
  lens: string;
  /** Called once when the child reaches the verified snap point. */
  onSolved: () => void;
}

/** While the child picks the lens, the figure shows at rest: no knobs, no coaching. */
export const SceneLock = createContext(false);

/** The guide as a scene sees it: silent while the figure is locked. */
export function useSceneGuide(): GuideApi {
  const g = useGuide();
  const locked = useContext(SceneLock);
  return useMemo(() => (locked ? { ...g, say: () => {}, coach: () => {} } : g), [g, locked]);
}

export function StripeDefs({ id = 'st' }: { id?: string }) {
  return (
    <defs>
      {C.palette.map((c, i) => (
        <pattern key={i} id={`${id}${i}`} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={12} height={12} fill={c} opacity={0.12} />
          <rect width={4.5} height={12} fill={c} opacity={0.85} />
        </pattern>
      ))}
    </defs>
  );
}

/** Text with a paper halo so it reads over lines and stripes. */
export function Txt({ x, y, children, size = 18, fill = C.ink, anchor = 'middle', ...rest }: { x: number; y: number; children: ReactNode; size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end' } & Omit<SVGProps<SVGTextElement>, 'x' | 'y' | 'fill'>) {
  return (
    <text x={x} y={y} fill={fill} fontSize={size} fontFamily={C.font} fontWeight={C.weight} textAnchor={anchor} paintOrder="stroke" stroke={C.paper} strokeWidth={5} strokeLinejoin="round" {...rest}>
      {children}
    </text>
  );
}

/** A grabbable ● with a generous hit area and a halo that pulses on the idle prompt. */
export function Knob({ x, y, fill, r = 15, onDown }: { x: number; y: number; fill: string; r?: number; onDown: (e: React.PointerEvent) => void }) {
  const { pulse } = useGuide();
  if (useContext(SceneLock)) return null;
  return (
    <g transform={`translate(${x},${y})`} onPointerDown={onDown} style={{ cursor: 'grab', touchAction: 'none' }} className="knob">
      <circle r={r + 14} fill="transparent" />
      <circle r={r + 6} fill={fill} opacity={0.16} />
      <circle key={pulse} r={r + 12} fill="none" stroke={fill} className={pulse ? 'halo pulse' : 'halo'} />
      <circle r={r} fill={C.paper} stroke={fill} strokeWidth={3} />
      <circle r={4} fill={fill} />
    </g>
  );
}

/**
 * The countable grid (Founder MVP, Oct 13): 1 square = 1 unit, brighter lines, a stronger line
 * every 5, numbered edges and a 1-unit scale bar. Colours: grid_minor / grid_major (tokens 1.6).
 */
export function CountableGrid({ X, Y, w, h, unit }: { X: (x: number) => number; Y: (y: number) => number; w: number; h: number; unit: string }) {
  const major = (i: number) => i % 5 === 0;
  const xs = Array.from({ length: w + 3 }, (_, i) => i - 1);
  const ys = Array.from({ length: h + 3 }, (_, i) => i - 1);
  const u = X(1) - X(0);
  return (
    <g className="countable-grid">
      {xs.map((i) => (
        <line key={`v${i}`} x1={X(i)} y1={Y(-1)} x2={X(i)} y2={Y(h + 1)} stroke={major(i) ? C.gridMajor : C.gridMinor} strokeWidth={major(i) ? 1.6 : 1} />
      ))}
      {ys.map((j) => (
        <line key={`h${j}`} x1={X(-1)} y1={Y(j)} x2={X(w + 1)} y2={Y(j)} stroke={major(j) ? C.gridMajor : C.gridMinor} strokeWidth={major(j) ? 1.6 : 1} />
      ))}
      {Array.from({ length: w + 1 }, (_, i) => (
        <Txt key={`nx${i}`} x={X(i)} y={Y(-1) + 17} size={12} fill={major(i) ? C.ink : C.quiet} strokeWidth={3} fontWeight={500}>
          {i}
        </Txt>
      ))}
      {Array.from({ length: h + 1 }, (_, j) => (
        <Txt key={`ny${j}`} x={X(-1) - 12} y={Y(j) + 4} size={12} fill={major(j) ? C.ink : C.quiet} strokeWidth={3} fontWeight={500}>
          {j}
        </Txt>
      ))}
      <line x1={X(w + 1) - u} y1={Y(h + 1) - 12} x2={X(w + 1)} y2={Y(h + 1) - 12} stroke={C.ink} strokeWidth={2} />
      <Txt x={X(w + 1) - u / 2} y={Y(h + 1) - 18} size={12} strokeWidth={3} fontWeight={500}>
        {`1${unit}`}
      </Txt>
    </g>
  );
}

/** Pointer drag in the coordinates of `svg`: captures the pointer, stops running springs, taps. */
export function useDrag(svg: RefObject<SVGSVGElement | null>) {
  const active = useRef<number | null>(null);
  return useCallback(
    (handlers: { start?: (p: DOMPoint) => void; move: (p: DOMPoint) => void; end?: (p: DOMPoint) => void }) =>
      (e: React.PointerEvent) => {
        const el = svg.current;
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        sfx.tap();
        stopSprings();
        const id = e.pointerId;
        active.current = id;
        el.setPointerCapture?.(id);
        const toSvg = (ev: PointerEvent | React.PointerEvent) => {
          const m = el.getScreenCTM();
          return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : new DOMPoint(0, 0);
        };
        handlers.start?.(toSvg(e));
        const move = (ev: PointerEvent) => {
          if (ev.pointerId === id) handlers.move(toSvg(ev));
        };
        const up = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return;
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          active.current = null;
          handlers.end?.(toSvg(ev));
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      },
    [svg],
  );
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A fraction string such as "4/3" or "12" as a number (drawing positions only). */
export function num(s: string): number {
  const [a, b] = s.split('/').map(Number);
  return b ? a! / b : a!;
}
