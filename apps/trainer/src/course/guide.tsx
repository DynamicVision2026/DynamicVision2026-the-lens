// The ナゼホリ guide (WO-012 §3b): mascot + speech bubble, the ghost finger on first use of each
// interaction phase, and the 5 s idle prompt (halo pulse + finger replay).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import discovery from '../../../../assets/ip/nazehori/nazehori_discovery.svg?url';
import question from '../../../../assets/ip/nazehori/nazehori_question.svg?url';
import { reducedMotion, TACTILE } from './fx';
import { firstTime } from './progress';

export type Pose = 'q' | 'd';
type Pt = [number, number];
type PtSource = Pt | (() => Pt | null);

export interface CoachSpec {
  /** Interaction phase, for "first time" onboarding per lens and phase. */
  phase: string;
  text: string;
  /** The finger's path, in the coordinates of `svg` (or of the stage when no svg). */
  from: PtSource;
  to?: PtSource;
  svg?: RefObject<SVGSVGElement | null>;
}

export interface GuideApi {
  say: (text: string, pose?: Pose) => void;
  /** Set the current interaction's coaching: bubble now, finger on first use, idle replay. */
  coach: (spec: CoachSpec) => void;
  /** What the idle prompt does during pick/clue (glow the options) instead of the finger. */
  idle: (fn: (() => void) | null) => void;
  /** Bumps on every idle prompt; knobs restart their halo when it changes. */
  pulse: number;
}

interface OverlayState {
  line: { text: string; pose: Pose; n: number };
  demos: Demo[];
}

const OverlayContext = createContext<OverlayState | null>(null);

const GuideContext = createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const g = useContext(GuideContext);
  if (!g) throw new Error('useGuide outside <GuideProvider>');
  return g;
}

interface Demo {
  id: number;
  a: Pt;
  b: Pt;
}

/** Provides the guide to a stage; renders the mascot, bubble and fingers over `stageRef`. */
export function GuideProvider({ lens, stageRef, children }: { lens: string; stageRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [line, setLine] = useState({ text: '', pose: 'q' as Pose, n: 0 });
  const [pulse, setPulse] = useState(0);
  const [demos, setDemos] = useState<Demo[]>([]);
  const idleFn = useRef<(() => void) | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const demoId = useRef(0);

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    if (idleFn.current) timer.current = window.setTimeout(() => {
      idleFn.current?.();
      arm();
    }, TACTILE.idleMs);
  }, []);

  useEffect(() => {
    const onTouch = () => arm();
    document.addEventListener('pointerdown', onTouch, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onTouch, { capture: true });
      window.clearTimeout(timer.current);
    };
  }, [arm]);

  const say = useCallback((text: string, pose: Pose = 'q') => setLine((l) => ({ text, pose, n: l.n + 1 })), []);

  const toStage = useCallback(
    (p: PtSource, svg?: RefObject<SVGSVGElement | null>): Pt | null => {
      const pt = typeof p === 'function' ? p() : p;
      const stage = stageRef.current;
      if (!pt || !stage) return null;
      const el = svg?.current;
      if (!el) return pt;
      const m = el.getScreenCTM();
      if (!m) return null;
      const sp = new DOMPoint(pt[0], pt[1]).matrixTransform(m);
      const r = stage.getBoundingClientRect();
      return [sp.x - r.left, sp.y - r.top];
    },
    [stageRef],
  );

  const demo = useCallback(
    (spec: CoachSpec) => {
      if (reducedMotion()) return;
      const a = toStage(spec.from, spec.svg);
      const b = toStage(spec.to ?? spec.from, spec.svg) ?? a;
      if (!a || !b) return;
      const id = ++demoId.current;
      setDemos((d) => [...d, { id, a, b }]);
      window.setTimeout(() => setDemos((d) => d.filter((x) => x.id !== id)), TACTILE.fingerMs * 2 + 100);
    },
    [toStage],
  );

  const setIdle = useCallback(
    (fn: (() => void) | null) => {
      idleFn.current = fn;
      arm();
    },
    [arm],
  );

  const coach = useCallback(
    (spec: CoachSpec) => {
      say(spec.text);
      setIdle(() => {
        setPulse((p) => p + 1);
        demo(spec);
      });
      if (firstTime(lens, spec.phase)) window.setTimeout(() => demo(spec), 700);
    },
    [say, setIdle, demo, lens],
  );

  const api = useMemo<GuideApi>(() => ({ say, coach, idle: setIdle, pulse }), [say, coach, setIdle, pulse]);

  return (
    <GuideContext.Provider value={api}>
      <OverlayContext.Provider value={{ line, demos }}>{children}</OverlayContext.Provider>
    </GuideContext.Provider>
  );
}

/** Mascot, bubble and ghost fingers; place inside the stage element. */
export function GuideOverlay() {
  const o = useContext(OverlayContext);
  if (!o) return null;
  return (
    <>
      <Mascot text={o.line.text} pose={o.line.pose} n={o.line.n} />
      {o.demos.map((d) => (
        <Finger key={d.id} a={d.a} b={d.b} />
      ))}
    </>
  );
}

function Mascot({ text, pose, n }: { text: string; pose: Pose; n: number }) {
  return (
    <div className="guide" aria-live="polite">
      <div className={`bot${n > 0 ? ' pop' : ''}`} key={`${pose}-${n}`}>
        <img src={pose === 'd' ? discovery : question} alt="" draggable={false} />
      </div>
      {text && (
        <div className="bubble say" key={n}>
          {text}
        </div>
      )}
    </div>
  );
}

function Finger({ a, b }: { a: Pt; b: Pt }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    const at = (p: Pt) => ({ left: `${p[0]}px`, top: `${p[1]}px` });
    const anim = el.animate(
      [
        { ...at(a), opacity: 0, transform: 'scale(1.5)' },
        { ...at(a), opacity: 0.95, transform: 'scale(1)', offset: 0.2 },
        { ...at(b), opacity: 0.95, transform: 'scale(1)', offset: 0.78 },
        { ...at(b), opacity: 0, transform: 'scale(1.2)' },
      ],
      { duration: TACTILE.fingerMs, iterations: 2, easing: 'ease-in-out' },
    );
    return () => anim.cancel();
  }, [a, b]);
  return <div ref={ref} className="finger" style={{ left: a[0], top: a[1] }} />;
}
