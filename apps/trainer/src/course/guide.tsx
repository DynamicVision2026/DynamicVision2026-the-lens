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
  /** Bumps on every idle prompt; knobs restart their halo when it changes; 0 again on the next touch. */
  pulse: number;
  /** WO-022: the idle prompt pulses one thing only, the coached target: is (x, y) it (in the coach's coordinates)? */
  isTarget: (x: number, y: number, tol?: number) => boolean;
}

/** WO-022: the ghost finger starts this long after the coaching line (well within 3 s). */
export const FINGER_DELAY_MS = 700;

/** Whether a coaching line shows the finger now: on first use of a phase, or always where it is guaranteed (masterclass). */
export const showsFinger = (firstUse: boolean, guaranteed: boolean) => guaranteed || firstUse;

/** Is a point the coached target, within `tol` (pure, for the knobs and the tests). */
export function onTarget(target: Pt | null, x: number, y: number, tol = 20): boolean {
  return !!target && Math.abs(target[0] - x) <= tol && Math.abs(target[1] - y) <= tol;
}

interface OverlayState {
  line: { text: string; pose: Pose; n: number };
  demos: Demo[];
  /** WO-022: the idle pulse for a target that is not an SVG knob (the 3D box's face): a ring over the stage. */
  ring: { at: Pt; n: number } | null;
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

/**
 * Provides the guide to a stage; renders the mascot, bubble and fingers over `stageRef`. `onCoach`
 * hears each interaction phase a scene coaches (the masterclass shows a lens step per phase).
 */
export function GuideProvider({
  lens,
  stageRef,
  onCoach,
  guaranteeFinger = false,
  onSay,
  children,
}: {
  lens: string;
  stageRef: RefObject<HTMLElement | null>;
  onCoach?: (phase: string) => void;
  /** WO-022: show the finger on every coaching line, not only the first time (masterclass examples). */
  guaranteeFinger?: boolean;
  /** WO-022: every bubble's text (the masterclass plays its clip). */
  onSay?: (text: string) => void;
  children: ReactNode;
}) {
  const [line, setLine] = useState({ text: '', pose: 'q' as Pose, n: 0 });
  const [pulse, setPulse] = useState(0);
  const [target, setTarget] = useState<Pt | null>(null);
  const [ring, setRing] = useState<{ at: Pt; n: number } | null>(null);
  const onSayRef = useRef(onSay);
  onSayRef.current = onSay;
  const [demos, setDemos] = useState<Demo[]>([]);
  const idleFn = useRef<(() => void) | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const demoId = useRef(0);
  const onCoachRef = useRef(onCoach);
  onCoachRef.current = onCoach;

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    if (idleFn.current) timer.current = window.setTimeout(() => {
      idleFn.current?.();
      arm();
    }, TACTILE.idleMs);
  }, []);

  useEffect(() => {
    // A touch stops the pulse and re-arms the idle prompt.
    const onTouch = () => {
      setPulse(0);
      setRing(null);
      arm();
    };
    document.addEventListener('pointerdown', onTouch, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onTouch, { capture: true });
      window.clearTimeout(timer.current);
    };
  }, [arm]);

  const say = useCallback((text: string, pose: Pose = 'q') => {
    setLine((l) => ({ text, pose, n: l.n + 1 }));
    onSayRef.current?.(text);
  }, []);

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
      window.setTimeout(() => setDemos((d) => d.filter((x) => x.id !== id)), TACTILE.fingerMs * TACTILE.fingerRepeats + 100);
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
      onCoachRef.current?.(spec.phase);
      say(spec.text);
      setIdle(() => {
        // The one target: where the coaching points (its knob), at the time of the prompt.
        const from = typeof spec.from === 'function' ? spec.from() : spec.from;
        setTarget(from);
        setPulse((p) => p + 1);
        // Without an SVG (no knob to pulse), the overlay rings the target instead.
        const at = !spec.svg && from ? toStage(from) : null;
        setRing(at ? (r) => ({ at, n: (r?.n ?? 0) + 1 }) : null);
        demo(spec);
      });
      if (showsFinger(firstTime(lens, spec.phase), guaranteeFinger)) window.setTimeout(() => demo(spec), FINGER_DELAY_MS);
    },
    [say, setIdle, demo, lens, guaranteeFinger, toStage],
  );

  const isTarget = useCallback((x: number, y: number, tol?: number) => onTarget(target, x, y, tol), [target]);
  const api = useMemo<GuideApi>(() => ({ say, coach, idle: setIdle, pulse, isTarget }), [say, coach, setIdle, pulse, isTarget]);

  return (
    <GuideContext.Provider value={api}>
      <OverlayContext.Provider value={{ line, demos, ring }}>{children}</OverlayContext.Provider>
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
      {o.ring && <div key={o.ring.n} className="target-ring pulse" style={{ left: o.ring.at[0], top: o.ring.at[1] }} />}
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
      { duration: TACTILE.fingerMs, iterations: TACTILE.fingerRepeats, easing: 'ease-in-out' },
    );
    return () => anim.cancel();
  }, [a, b]);
  return <div ref={ref} className="finger" style={{ left: a[0], top: a[1] }} />;
}
