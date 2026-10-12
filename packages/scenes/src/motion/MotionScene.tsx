import { parseEasing } from '../easing';
import { answerText, formatExact } from '../format';
import { boundingBox, boxCorners, centroid, enclosureGaps, partialPolyline } from '../geometry';
import { ConstructionLine, FigurePolygon, GridLayer, LensIcon, makeFrame, RegionShade, svgPoints, toSvg, TrapScratch } from '../primitives';
import { wrapText } from '../text';
import { color, fontFamily, fontSize, lensColor, type RenderMode } from '../tokens';
import type { GlowToken, LensCard, Point, Tokens } from '../types';
import { motionState } from './beats';
import type { Beat } from './timeline';

export interface MotionSceneProps {
  card: LensCard;
  beats: Beat[];
  beat: number;
  /** Raw progress 0–1 within the beat (each beat applies the easing token itself). */
  t: number;
  tokens: Tokens;
  glow: GlowToken | null;
  mode: RenderMode;
  width: number;
  height: number;
  pad: number;
  figureHeight: number;
}

/** How far a corner slides outward while it collapses, in scene units (~24 px in the Short). */
const SLIDE = 11;
const MINUS = ' − ';

/** The Enclose motion preview: chalk trap → lens → laser box → corners → collapse → glowing core. */
export function MotionScene({ card, beats, beat, t, tokens, glow, mode, width, height, pad, figureHeight }: MotionSceneProps) {
  const { grid, points } = card.problem.figure;
  const gaps = enclosureGaps(points);
  const steps = card.lens_route.steps;
  const subs = steps.filter((s) => s.op === 'sub');
  const start = steps.find((s) => s.op === 'start');
  const result = steps.find((s) => s.op === 'result');
  const state = motionState(beats, beat, t, {
    corners: gaps.length,
    tokens,
    ease: parseEasing(tokens.motion.easing),
    spring: tokens.motion.spring,
  });

  const frame = makeFrame(grid, pad, pad, width - 2 * pad, figureHeight - 2 * pad);
  const lens = card.lens;
  const accent = lensColor(tokens, lens, mode);
  const ink = color(tokens.color.ink, mode);
  const chalk = color(tokens.color.trap.ink, mode);
  const box = boundingBox(points);
  const boxPath: Point[] = [...boxCorners(box), boxCorners(box)[0]!];
  const [cx, cy] = toSvg(frame, centroid(points));
  const glowId = `lens-glow-${card.id}`;
  const glowFilter = glow ? `url(#${glowId})` : undefined;
  const pulse = glow
    ? glow.pulse_min_opacity +
      (glow.opacity - glow.pulse_min_opacity) * (0.5 + 0.5 * Math.cos((2 * Math.PI * state.pulseMs) / glow.pulse_period_ms))
    : 0;

  const tip = state.box > 0 && state.box < 1 ? partialPolyline(boxPath, state.box).at(-1) : undefined;
  const headR = tokens.stroke.lens.width * 1.6;

  const titleScale = tokens.type.scale.title;
  const titleSize = fontSize(tokens, 'title', mode);
  const bandTop = figureHeight;
  const terms = start ? [start, ...subs] : subs;
  const triggerSize = fontSize(tokens, 'trigger', mode);
  const triggerLines = wrapText(card.trigger.ja, width - 2 * pad, triggerSize);

  return (
    <g>
      {glow && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow.blur_px / 2} />
          </filter>
        </defs>
      )}

      <g opacity={state.grid}>
        <GridLayer frame={frame} tokens={tokens} mode={mode} />
      </g>

      {gaps.map((gap, i) => {
        const [gx, gy] = toSvg(frame, centroid(gap));
        const len = Math.hypot(gx - cx, gy - cy) || 1;
        const r = state.cornerRemove[i] ?? 0;
        const dx = ((gx - cx) / len) * SLIDE * r;
        const dy = ((gy - cy) / len) * SLIDE * r;
        const fill = (state.cornerFill[i] ?? 0) * (1 - r);
        const label = state.cornerLabel[i] ?? 0;
        const step = subs[i];
        return (
          <g key={`corner${i}`} transform={`translate(${dx} ${dy})`}>
            <RegionShade frame={frame} points={gap} lens={lens} tokens={tokens} mode={mode} t={fill} />
            {step?.value !== undefined && label > 0 && (
              <text
                x={gx}
                y={gy}
                transform={`translate(${gx} ${gy}) scale(${label}) translate(${-gx} ${-gy})`}
                opacity={Math.min(1, label) * (1 - r)}
                fill={ink}
                fontFamily={fontFamily(tokens, undefined, 'family_num')}
                fontSize={fontSize(tokens, 'step', mode)}
                fontWeight={tokens.type.scale.label.weight}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {formatExact(step.value)}
              </text>
            )}
          </g>
        );
      })}

      {state.core > 0 && (
        <RegionShade frame={frame} points={points} lens={lens} tokens={tokens} mode={mode} t={state.core} />
      )}
      <FigurePolygon frame={frame} points={points} tokens={tokens} mode={mode} t={state.chalk * (1 - state.inked)} ink={chalk} dash={tokens.stroke.trap.dash} />
      <FigurePolygon frame={frame} points={points} tokens={tokens} mode={mode} t={state.chalk * state.inked} />
      {glow && state.coreGlow > 0 && (
        <g filter={glowFilter} opacity={pulse * state.coreGlow}>
          <polygon
            points={svgPoints(frame, points)}
            fill="none"
            stroke={accent}
            strokeWidth={tokens.stroke.lens.width}
            strokeLinejoin={tokens.stroke.join}
          />
        </g>
      )}

      {glow && state.glow > 0 && state.boxFade > 0 && (
        <g filter={glowFilter} opacity={glow.opacity * state.glow * state.boxFade}>
          <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} t={state.box} stroke={tokens.stroke.lens} />
        </g>
      )}
      <ConstructionLine frame={frame} path={boxPath} lens={lens} tokens={tokens} mode={mode} t={state.box} opacity={state.boxFade} />
      {tip && (
        <g>
          {glow && <circle cx={toSvg(frame, tip)[0]} cy={toSvg(frame, tip)[1]} r={headR} fill={accent} filter={glowFilter} opacity={glow.opacity} />}
          <circle cx={toSvg(frame, tip)[0]} cy={toSvg(frame, tip)[1]} r={headR} fill={accent} />
        </g>
      )}

      {state.scratch > 0 && (
        <g opacity={state.scratch}>
          <TrapScratch steps={card.trap_route.steps.slice(0, 2)} x={pad + 40} y={bandTop + 4} width={width - 2 * pad - 40} tokens={tokens} mode={mode} />
        </g>
      )}
      {state.icon > 0 && (
        <g transform={`translate(${pad + 14} ${bandTop + 26}) scale(${state.icon}) translate(${-(pad + 14)} ${-(bandTop + 26)})`} opacity={Math.min(1, state.icon)}>
          <LensIcon lens={lens} tokens={tokens} mode={mode} x={pad} y={bandTop + 12} size={28} />
        </g>
      )}

      <text
        x={width / 2}
        y={bandTop + 34}
        textAnchor="middle"
        fill={ink}
        fontFamily={fontFamily(tokens, undefined, 'family_num')}
        fontSize={titleSize}
        fontWeight={titleScale.weight}
        opacity={1 - state.result}
      >
        {terms.map((step, i) => (
          <tspan key={i} opacity={state.terms[i] ?? 0}>
            {(i === 0 ? '' : MINUS) + (step.value !== undefined ? formatExact(step.value) : '')}
          </tspan>
        ))}
      </text>
      {result && state.result > 0 && (
        <text x={width / 2} y={bandTop + 34} textAnchor="middle" fill={ink} fontFamily={fontFamily(tokens, undefined, 'family_num')} fontSize={titleSize} fontWeight={titleScale.weight} opacity={state.result}>
          {result.ja}
        </text>
      )}

      {state.display > 0 && (
        <text
          x={width / 2}
          y={bandTop + 108}
          transform={`translate(${width / 2} ${bandTop + 94}) scale(${state.display}) translate(${-width / 2} ${-(bandTop + 94)})`}
          opacity={Math.min(1, state.display)}
          fill={accent}
          fontFamily={fontFamily(tokens, tokens.type.scale.display, 'family_num')}
          fontSize={fontSize(tokens, 'display', mode) * 1.5}
          fontWeight={tokens.type.scale.display.weight}
          textAnchor="middle"
        >
          {answerText(card)}
        </text>
      )}
      {state.trigger > 0 &&
        triggerLines.map((line, i) => (
          <text
            key={i}
            x={width / 2}
            y={height - pad - 8 - (triggerLines.length - 1 - i) * triggerSize * tokens.type.scale.trigger.line}
            opacity={state.trigger}
            fill={ink}
            fontFamily={fontFamily(tokens, tokens.type.scale.trigger)}
            fontSize={triggerSize}
            fontWeight={tokens.type.scale.trigger.weight}
            textAnchor="middle"
          >
            {line}
          </text>
        ))}
    </g>
  );
}
