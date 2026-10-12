import {
  allSceneCards,
  LensIcon,
  LensScene,
  loadBundle,
  motionPreviewTimeline,
  SCENE_WIDTH,
  TimeStrip,
  tokens,
  TrapScratch,
  type LensOrDirect,
  type ThemeName,
} from '@lens/scenes';
import { useEffect, useMemo, useState } from 'react';

const cards = allSceneCards(loadBundle());

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Review surface for WO-002: every card and variant, keyframe selector, t slider, play. */
export function DevScenes() {
  const [cardId, setCardId] = useState(cards[0]!.id);
  const [keyframe, setKeyframe] = useState(0);
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [matrixT, setMatrixT] = useState<0 | 1 | null>(null);
  const [theme, setTheme] = useState<ThemeName>('base');
  const [motionOn, setMotionOn] = useState(false);

  const card = useMemo(() => cards.find((c) => c.id === cardId) ?? cards[0]!, [cardId]);
  const beats = useMemo(() => (motionOn ? motionPreviewTimeline(card, tokens) : null), [card, motionOn]);
  // In motion-preview mode the selector steps through beats; otherwise through the card's keyframes.
  const keyframes = beats ? beats.map((b) => b.name) : (card.animation?.keyframes ?? ['show_shape']);

  // Play: drive t with requestAnimationFrame, one keyframe after another.
  useEffect(() => {
    if (!playing) return;
    const fallback = tokens.motion.duration_ms.draw_line + tokens.motion.duration_ms.pause_after_reveal;
    const durationOf = (i: number) => beats?.[i]?.durationMs ?? fallback;
    let k = keyframe;
    let start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = (now - start) / durationOf(k);
      if (p >= 1) {
        if (k >= keyframes.length - 1) {
          setT(1);
          setPlaying(false);
          return;
        }
        k += 1;
        start = now;
        setKeyframe(k);
        setT(0);
      } else {
        setT(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const selectCard = (id: string) => {
    setCardId(id);
    setKeyframe(0);
    setT(1);
    setPlaying(false);
  };

  return (
    <main>
      <h1>/dev/scenes</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gutter)', alignItems: 'center' }}>
        <label>
          card{' '}
          <select value={cardId} onChange={(e) => selectCard(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          keyframe{' '}
          <select value={keyframe} onChange={(e) => setKeyframe(Number(e.target.value))}>
            {keyframes.map((k, i) => (
              <option key={k} value={i}>
                {i}: {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          t {t.toFixed(2)}{' '}
          <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
        <button type="button" onClick={() => { if (!playing) { setKeyframe(0); setT(0); } setPlaying(!playing); }}>
          {playing ? 'stop' : 'play'}
        </button>
        <label>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> reducedMotion
        </label>
        <label>
          theme{' '}
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
            <option value="base">base</option>
            <option value="short_dark">short_dark</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={motionOn}
            onChange={(e) => {
              setMotionOn(e.target.checked);
              setKeyframe(0);
              setT(1);
              setPlaying(false);
            }}
          />{' '}
          motion preview{motionOn && !beats ? ' (standard Enclose cards only)' : ''}
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gutter)', marginTop: 'var(--gutter)' }}>
        <div style={{ width: SCENE_WIDTH, maxWidth: '100%' }} data-testid="scene">
          <LensScene card={card} keyframe={keyframe} t={t} reducedMotion={reducedMotion} theme={theme} motion={beats} />
        </div>
        <svg viewBox={`0 0 ${SCENE_WIDTH} 420`} style={{ width: SCENE_WIDTH, maxWidth: '100%', background: 'var(--paper)' }}>
          <TrapScratch steps={card.trap_route.steps} x={16} y={16} width={SCENE_WIDTH - 32} tokens={tokens} t={t} />
          <TimeStrip trap={card.trap_route} lens={card.lens_route} lensId={card.lens} x={16} y={300} width={SCENE_WIDTH - 32} tokens={tokens} t={t} />
          {(card.picker.options as LensOrDirect[]).map((lens, i) => (
            <LensIcon key={lens} lens={lens} tokens={tokens} x={16 + i * 48} y={380} size={32} />
          ))}
        </svg>
      </div>

      <h2>All cards × keyframes</h2>
      <div style={{ display: 'flex', gap: 'var(--gutter)' }}>
        <button type="button" onClick={() => setMatrixT(0)}>t = 0</button>
        <button type="button" onClick={() => setMatrixT(1)}>t = 1</button>
        <button type="button" onClick={() => setMatrixT(null)}>hide</button>
      </div>
      {matrixT !== null && (
        <div data-testid="matrix">
          {cards.map((c) => (
            <section key={c.id}>
              <h3>{c.id}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gutter)' }}>
                {(c.animation?.keyframes ?? ['show_shape']).map((k, i) => (
                  <figure key={k} style={{ width: 160, margin: 0 }}>
                    <LensScene card={c} keyframe={i} t={matrixT} />
                    <figcaption>{k}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
