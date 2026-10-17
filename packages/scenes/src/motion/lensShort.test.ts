import { describe, expect, it } from 'vitest';
import { getCard, loadBundle } from '../bundle';
import { tokens } from '../tokens';
import { canShort, estimateSpeechMs, lensShortPlan, shortLines, shortOptions, shortSegmentAt, speechText, SHORT_MS } from './lensShort';
import { SHORT_COPY } from './MotionScene';

const bundle = loadBundle();
const label = (lens: string) => bundle.labels.lenses[lens]?.ja ?? lens;
const plan = (id: string) => {
  const card = getCard(id)!;
  return lensShortPlan(card, tokens, label(card.lens))!;
};
const shortable = bundle.cards.filter(canShort);

describe('LensShort plan (WO-028)', () => {
  it('covers every lens on every stage', () => {
    const seen = new Set(shortable.map((c) => `${c.stage}/${c.lens}`));
    for (const stage of ['shogakko', 'chugaku', 'koko']) {
      for (const lens of ['enclose', 'slide', 'area', 'constant', 'balance', 'freeze', 'mirror', 'unfold']) {
        expect(seen.has(`${stage}/${lens}`), `${stage}/${lens}`).toBe(true);
      }
    }
  });

  it('runs hook → choice → trap → lens steps → CTA on the beat sheet', () => {
    const p = plan('constant-001');
    expect(p.segments.map((s) => s.kind)).toEqual(['hook', 'choice', 'trap', 'lens', 'lens', 'lens', 'lens', 'lens', 'cta']);
    expect(p.segments[0]!.startMs).toBe(0);
    expect(p.segments[1]!.startMs).toBe(SHORT_MS.hook);
    expect(p.segments[2]!.startMs).toBe(SHORT_MS.hook + SHORT_MS.choice);
    expect(p.segments[p.segments.length - 1]!.durationMs).toBeGreaterThanOrEqual(SHORT_MS.cta);
    // Contiguous, ending at the total.
    p.segments.forEach((s, i) => i > 0 && expect(s.startMs).toBe(p.segments[i - 1]!.startMs + p.segments[i - 1]!.durationMs));
    const last = p.segments[p.segments.length - 1]!;
    expect(last.startMs + last.durationMs).toBe(p.totalMs);
  });

  it('never starts below 30 s, and stretches lens steps (not the hook) to get there', () => {
    for (const card of shortable) {
      const p = lensShortPlan(card, tokens, label(card.lens))!;
      expect(p.totalMs, card.id).toBeGreaterThanOrEqual(SHORT_MS.min);
      expect(p.segments[0]!.durationMs).toBeLessThan(SHORT_MS.choice);
    }
  });

  it('gives a voice line room: a long clip lengthens its segment', () => {
    const card = getCard('constant-001')!;
    const p = lensShortPlan(card, tokens, label(card.lens), (k) => (k === 'step1' ? 9000 : undefined))!;
    const step1 = p.segments.find((s) => s.step === 0)!;
    expect(step1.durationMs).toBeGreaterThanOrEqual(9000 + SHORT_MS.voicePad);
  });

  it('walks the keyframes like the masterclass: monotone, ending on the last keyframe', () => {
    for (const card of shortable) {
      const p = lensShortPlan(card, tokens, label(card.lens))!;
      const lens = p.segments.filter((s) => s.kind === 'lens' && s.step! >= 0);
      // Every lens step is shown exactly once, in order (some share a segment when compressed).
      expect(lens.flatMap((s) => s.steps)).toEqual(card.lens_route.steps.map((_, i) => i));
      lens.forEach((s, i) => i > 0 && expect(s.kfFrom).toBe(lens[i - 1]!.kfTo));
      expect(lens[lens.length - 1]!.kfTo).toBe(card.animation!.keyframes.length - 1);
    }
  });

  it('shows three chips with the correct lens among them', () => {
    for (const card of shortable) {
      const o = shortOptions(card);
      expect(o).toHaveLength(Math.min(3, card.picker.options.length));
      expect(o).toContain(card.picker.correct);
    }
  });

  it('speaks the series line, the trap, the lens, every lens step and the CTA', () => {
    const card = getCard('constant-001')!;
    const lines = shortLines(card, label(card.lens));
    expect(lines.map((l) => l.key)).toEqual(['hook', 'trap', 'lens', 'step1', 'step2', 'step3', 'step4', 'cta']);
    expect(lines[0]!.text).toBe(SHORT_COPY.hook);
    expect(lines[1]!.text).toContain(card.trap_route.steps[0]!.ja);
    expect(lines[3]!.text).toBe(card.lens_route.steps[0]!.ja);
  });

  it('spells math out for the voice, keeps the caption exact', () => {
    expect(speechText('年れいの差は 38−8 = 30 で')).toBe('年れいの差は 38ひく8は30 で');
    expect(speechText('そのときの子どもは 30÷2 = 15 才')).toBe('そのときの子どもは 30わる2は15 才');
    expect(speechText("点B'(6, −5)")).toBe('点Bダッシュ 6, マイナス5');
    expect(speechText('すみの三角形 3×3÷2')).toBe('すみの三角形 3かける3わる2');
    expect(speechText('△ABP は 15cm²')).toBe('三角形ABP は 15平方センチメートル');
    expect(estimateSpeechMs('あいうえお')).toBeGreaterThan(500);
  });

  it('compresses long routes to fit 45 s, keeping every step on screen', () => {
    const card = getCard('kj-mirror-001')!;
    const p = plan('kj-mirror-001');
    expect(p.level).toBeGreaterThan(0);
    const merged = p.segments.find((s) => (s.steps?.length ?? 0) > 1)!;
    expect(merged.steps!.every((i) => card.lens_route.steps[i]!.op === 'sub')).toBe(true);
    expect(merged.line!.text).toContain(card.lens_route.steps[merged.steps![0]!]!.ja);
    expect(shortable.some((c) => lensShortPlan(c, tokens, label(c.lens))!.level === 0)).toBe(true);
  });

  it('maps time to segments', () => {
    const p = plan('dj-freeze-001');
    expect(shortSegmentAt(p, 0).segment.kind).toBe('hook');
    expect(shortSegmentAt(p, SHORT_MS.hook + 10).segment.kind).toBe('choice');
    expect(shortSegmentAt(p, p.totalMs + 999)).toMatchObject({ index: p.segments.length - 1, t: 1 });
  });

  it('reports the cards it cannot draw (none of the standard cards with a scene)', () => {
    const missing = bundle.cards.filter((c) => c.kind === 'standard' && !canShort(c)).map((c) => c.id);
    console.log(`LensShort: ${shortable.length} standard cards can be Shorts; without a scene: ${missing.join(', ') || 'none'}`);
    const totals = shortable.map((c) => [c.id, lensShortPlan(c, tokens, label(c.lens))!.totalMs / 1000] as const);
    const over = totals.filter(([, s]) => s > SHORT_MS.max / 1000);
    console.log(`Over 45 s with estimated voice: ${over.map(([id, s]) => `${id} ${s.toFixed(1)}`).join(', ') || 'none'}`);
  });
});
