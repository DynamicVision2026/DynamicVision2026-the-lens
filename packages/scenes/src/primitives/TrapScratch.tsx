import { stagger } from '../easing';
import { countUp } from '../format';
import { wrapText } from '../text';
import { color, dashArray, fontFamily, fontSize, type RenderMode } from '../tokens';
import type { Step, Tokens } from '../types';

interface Props {
  steps: Step[];
  x: number;
  y: number;
  width: number;
  tokens: Tokens;
  mode?: RenderMode;
  /** 0–1: steps appear one after another. */
  t?: number;
}

/** Trap-route steps as an honest student's handwriting: Klee One, muted ink, dashed underlines. */
export function TrapScratch({ steps, x, y, width, tokens, mode, t = 1 }: Props) {
  const scale = tokens.type.scale.scratch;
  const size = fontSize(tokens, 'scratch', mode);
  const lineHeight = size * scale.line;
  const ink = color(tokens.color.trap.ink, mode);
  let cursor = y;
  return (
    <g fill={ink} fontFamily={fontFamily(tokens, scale)} fontSize={size} fontWeight={scale.weight}>
      {steps.map((step, i) => {
        const p = stagger(t, i, steps.length);
        const text = step.value !== undefined && step.op !== 'note' && step.op !== 'result'
          ? `${step.ja}（${countUp(step.value, 1)}）`
          : step.ja;
        const lines = wrapText(text, width, size);
        const top = cursor;
        cursor += lines.length * lineHeight + lineHeight * 0.4;
        if (p <= 0) return null;
        const underline = top + lines.length * lineHeight - lineHeight * 0.15;
        return (
          <g key={i} opacity={p}>
            {lines.map((line, j) => (
              <text key={j} x={x} y={top + (j + 0.75) * lineHeight}>
                {line}
              </text>
            ))}
            <line
              x1={x}
              y1={underline}
              x2={x + width * p}
              y2={underline}
              stroke={ink}
              strokeWidth={tokens.stroke.trap.width}
              strokeDasharray={dashArray(tokens.stroke.trap.dash)}
              strokeLinecap={tokens.stroke.cap}
            />
          </g>
        );
      })}
    </g>
  );
}
