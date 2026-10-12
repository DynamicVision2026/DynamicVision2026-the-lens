// Token adapter: the only style source for scenes and apps (tokens/tokens.json).
import raw from '../../../tokens/tokens.json';
import type { ColorToken, LensId, Tokens, TypeScaleToken } from './types';

export const tokens = raw as unknown as Tokens;

/** 'print' is a Phase 2 stub: it currently resolves to the screen values. */
export type RenderMode = 'screen' | 'print';

export type TypeScaleName = keyof Tokens['type']['scale'];
export type LensOrDirect = LensId | 'direct';

export function color(token: ColorToken, _mode: RenderMode = 'screen'): string {
  return token.value;
}

export function lensColor(t: Tokens, lens: LensOrDirect, mode: RenderMode = 'screen'): string {
  return color(t.color.lens[lens], mode);
}

export function fontFamily(t: Tokens, scale: TypeScaleToken | undefined, fallback: 'family_ja' | 'family_num' = 'family_ja'): string {
  const key = scale?.family ?? fallback;
  return `"${t.type[key]}", ${key === 'family_hand' ? 'cursive' : 'sans-serif'}`;
}

/** Point size for a type scale step; on screen never below `type.screen_min_px`. */
export function fontSize(t: Tokens, name: TypeScaleName, mode: RenderMode = 'screen'): number {
  const size = t.type.scale[name].size;
  return mode === 'screen' ? Math.max(size, t.type.screen_min_px) : size;
}

export function dashArray(dash: string): string | undefined {
  return dash === 'none' ? undefined : dash;
}

/** CSS custom properties for the app shell, e.g. `--lens-enclose`, `--stroke-lens`. */
export function cssVars(t: Tokens = tokens, mode: RenderMode = 'screen'): Record<string, string> {
  const vars: Record<string, string> = {
    '--paper': color(t.color.paper, mode),
    '--ink': color(t.color.ink, mode),
    '--ink-quiet': color(t.color.ink_quiet, mode),
    '--grid': color(t.color.grid, mode),
    '--trap-ink': color(t.color.trap.ink, mode),
    '--trap-tint': color(t.color.trap.tint, mode),
    '--trap-flag': color(t.color.trap.flag, mode),
    '--correct': color(t.color.correct, mode),
    '--miss': color(t.color.miss, mode),
    '--lens-tint-opacity': String(t.color.lens_tint_opacity),
    '--font-ja': `"${t.type.family_ja}", sans-serif`,
    '--font-num': `"${t.type.family_num}", sans-serif`,
    '--font-hand': `"${t.type.family_hand}", cursive`,
    '--easing': t.motion.easing,
    '--tap-target': `${t.layout.trainer.tap_target_px}px`,
    '--gutter': `${t.layout.trainer.gutter_px}px`,
    '--max-width': `${t.layout.trainer.max_width_px}px`,
  };
  for (const [lens, token] of Object.entries(t.color.lens)) {
    if (typeof token === 'object') vars[`--lens-${lens}`] = color(token, mode);
  }
  for (const name of ['grid', 'grid_major', 'figure', 'trap', 'lens', 'lens_construction'] as const) {
    const key = name.replace('_', '-');
    vars[`--stroke-${key}`] = `${t.stroke[name].width}px`;
  }
  for (const [name, scale] of Object.entries(t.type.scale)) {
    vars[`--type-${name}-size`] = `${fontSize(t, name as TypeScaleName, mode)}px`;
    vars[`--type-${name}-weight`] = String(scale.weight);
  }
  for (const [name, ms] of Object.entries(t.motion.duration_ms)) {
    vars[`--duration-${name.replaceAll('_', '-')}`] = `${ms}ms`;
  }
  return vars;
}
