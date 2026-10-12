import { countUp } from '../format';
import { color, fontFamily, fontSize, type RenderMode } from '../tokens';
import type { Step, Tokens } from '../types';

interface Props {
  step: Step;
  x: number;
  y: number;
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1: fades in and counts the value up; exact at t = 1. */
  t?: number;
  /** Show the step's Japanese text before the value. */
  showText?: boolean;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
}

/** One step's `ja` text and value. The value is read from the step, never computed. */
export function StepLabel({ step, x, y, tokens, mode, t = 1, showText = false, fill, anchor = 'middle' }: Props) {
  if (t <= 0) return null;
  const scale = tokens.type.scale.step;
  const size = fontSize(tokens, 'step', mode);
  const ink = fill ?? color(tokens.color.ink, mode);
  return (
    <text x={x} y={y} fill={ink} fontSize={size} fontWeight={scale.weight} textAnchor={anchor} dominantBaseline="central" opacity={Math.min(1, t * 2)}>
      {showText && (
        <tspan fontFamily={fontFamily(tokens, scale)}>{step.ja} </tspan>
      )}
      {step.value !== undefined && (
        <tspan fontFamily={fontFamily(tokens, scale, 'family_num')} fontWeight={tokens.type.scale.label.weight}>
          {countUp(step.value, t)}
        </tspan>
      )}
    </text>
  );
}
