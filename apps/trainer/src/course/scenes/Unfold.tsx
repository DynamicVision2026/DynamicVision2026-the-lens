// 展開: the 3D box (lazy-loaded, WO-012 §2) — open face BCGF, then slide P until the string is
// straight. Without WebGL, after a lost context or with reduced motion, the flat net (SVG) plays
// the same final step. P snaps only at the card's answer.
import { answerText, formatExact, LensScene, unfoldP, type BoxUnfoldFigure, type LensCard } from '@lens/scenes';
import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { reducedMotion, sfx, springTo, TACTILE } from '../fx';
import { UnfoldThreeScene } from './UnfoldThree';
import { C, clamp, Knob, SceneLock, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

/** What P says once it snaps: BP (the answer), or for `ask: length` (WO-023) the string's length A–G. */
function solvedP(card: LensCard): string {
  const fig = card.problem.figure as BoxUnfoldFigure;
  const L = fig.point_labels;
  return fig.ask === 'length' ? `${L.P}（${L.A}${L.G}=${answerText(card)}）` : `${L.P}（${L.B}${L.P}=${formatExact(card.answer.value)}${fig.unit}）`;
}

const Unfold3D = lazy(() => import('@lens/scene3d').then((m) => ({ default: m.Unfold3D })));

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function UnfoldScene(props: SceneProps) {
  const locked = useContext(SceneLock);
  // Three-face cards always play flat, so they never probe WebGL.
  const [flat, setFlat] = useState(() => (props.card.problem.figure as BoxUnfoldFigure).route === 'three_faces' || reducedMotion() || !webglAvailable());
  if (locked) return <LensScene card={props.card} keyframe={0} t={1} theme="short_dark" />;
  // WO-018 L4: three faces open flat (the 3D box opens one face only).
  if ((props.card.problem.figure as BoxUnfoldFigure).route === 'three_faces') return <UnfoldThreeScene {...props} />;
  if (flat) return <FlatUnfold {...props} />;
  return (
    <Suspense fallback={<Loading />}>
      <Unfold3DScene {...props} onLost={() => setFlat(true)} />
    </Suspense>
  );
}

function Loading() {
  const guide = useSceneGuide();
  useEffect(() => guide.say(t('guide.unfold.loading')), [guide]);
  return <div className="unfold-loading" />;
}

function Unfold3DScene({ card, lens, onSolved, onLost }: SceneProps & { onLost: () => void }) {
  const fig = card.problem.figure as BoxUnfoldFigure;
  const guide = useSceneGuide();
  const anchors = useRef<((a: 'face' | 'p') => [number, number] | null) | null>(null);
  const len = (v: number | string) => `${v}${fig.unit}`;

  useEffect(() => {
    guide.coach({ phase: 'face', text: t('guide.unfold.face'), from: () => anchors.current?.('face') ?? null, to: () => {
      const p = anchors.current?.('face');
      return p ? [p[0] + 130, p[1]] : null;
    } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  return (
    <div className="stage3d">
      <Unfold3D
        dims={{ a: fig.a, b: fig.b, h: fig.h }}
        mesh={fig.mesh?.vertices}
        answer={unfoldP(card)}
        labels={{ points: fig.point_labels, ab: len(fig.a), bc: len(fig.b), bf: len(fig.h), solvedP: solvedP(card) }}
        colors={{ lens: C.lens(lens), ink: C.ink, front: C.palette[0]!, face: C.palette[1]!, paper: C.paper }}
        anchors={anchors}
        onTouch={() => sfx.tap()}
        onOpened={() => {
          sfx.snap();
          guide.coach({ phase: 'p', text: t('guide.unfold.p'), from: () => anchors.current?.('p') ?? null, to: () => {
            const p = anchors.current?.('p');
            return p ? [p[0], p[1] - 50] : null;
          } });
        }}
        onMiss={(dir) => guide.say(dir === 'down' ? t('guide.unfold.down') : t('guide.unfold.up'))}
        onSolved={() => {
          sfx.snap();
          window.setTimeout(onSolved, 500);
        }}
        onContextLost={onLost}
      />
    </div>
  );
}

/** The fallback: the net already opened flat; slide P on BF until A–P–G is straight. */
function FlatUnfold({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as BoxUnfoldFigure;
  const L = fig.point_labels;
  const ans = unfoldP(card);
  const s = Math.min(480 / (fig.a + fig.b), 300 / fig.h);
  const x0 = (600 - (fig.a + fig.b) * s) / 2;
  const y0 = 360;
  const X = (x: number) => x0 + x * s;
  const Y = (y: number) => y0 - y * s;
  const color = C.lens(lens);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [pY, setPY] = useState(fig.h / 2);
  const pRef = useRef(pY);
  pRef.current = pY;
  const [done, setDone] = useState(false);

  useEffect(() => {
    guide.coach({ phase: 'p', text: t('guide.unfold.p'), svg, from: () => [X(fig.a), Y(pRef.current)], to: () => [X(fig.a), Y(pRef.current) - 50] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => {
      if (!done) setPY(clamp((y0 - p.y) / s, 0.02 * fig.h, 0.98 * fig.h));
    },
    end: () => {
      if (done) return;
      if (Math.abs(pRef.current - ans) < fig.h * 0.07) {
        setDone(true);
        springTo('unfold-p', pRef.current, ans, setPY, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 400);
          },
        });
      } else guide.say(pRef.current > ans ? t('guide.unfold.down') : t('guide.unfold.up'));
    },
  });

  // The flat net's corners: the validator's figure.mesh.net when present, else from a, b, h.
  const net = fig.mesh?.net;
  const at = (k: 'A' | 'G', fx: number, fy: number) => (net?.[k] ? [X(net[k]![0]), Y(net[k]![1])] : [X(fx), Y(fy)]);
  const A = at('A', 0, 0);
  const P = [X(fig.a), Y(pY)];
  const G = at('G', fig.a + fig.b, fig.h);
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-unfold-flat">
      <StripeDefs />
      <rect x={X(0)} y={Y(fig.h)} width={fig.a * s} height={fig.h * s} fill={C.palette[0]} fillOpacity={0.16} stroke={C.ink} strokeWidth={2} />
      <rect x={X(fig.a)} y={Y(fig.h)} width={fig.b * s} height={fig.h * s} fill={C.palette[1]} fillOpacity={0.2} stroke={C.ink} strokeWidth={2} />
      <line x1={X(fig.a)} y1={Y(0)} x2={X(fig.a)} y2={Y(fig.h)} stroke={color} strokeWidth={4} />
      <polyline points={`${A[0]},${A[1]} ${P[0]},${P[1]} ${G[0]},${G[1]}`} fill="none" stroke={done ? color : C.ink} strokeWidth={done ? 5 : 3} strokeLinejoin="round" />
      {(
        [
          ['A', 0, 0, -14, 14],
          ['B', fig.a, 0, 0, 22],
          ['C', fig.a + fig.b, 0, 14, 14],
          ['E', 0, fig.h, -14, -8],
          ['F', fig.a, fig.h, 0, -12],
          ['G', fig.a + fig.b, fig.h, 14, -8],
        ] as const
      ).map(([k, x, y, dx, dy]) => (
        <Txt key={k} x={X(x) + dx} y={Y(y) + dy} size={16} fill={C.quiet}>
          {L[k]}
        </Txt>
      ))}
      <Txt x={X(fig.a / 2)} y={Y(0) + 44} size={16} fill={C.palette[0]}>{`${fig.a}${fig.unit}`}</Txt>
      <Txt x={X(fig.a + fig.b / 2)} y={Y(0) + 44} size={16} fill={C.palette[1]}>{`${fig.b}${fig.unit}`}</Txt>
      <Txt x={X(0) - 30} y={Y(fig.h / 2)} size={16} fill={C.quiet}>{`${fig.h}${fig.unit}`}</Txt>
      <Txt x={P[0]! + 34} y={P[1]! + 6} fill={color}>
        {done ? solvedP(card) : L.P}
      </Txt>
      {!done && <Knob x={P[0]!} y={P[1]!} fill={color} r={13} onDown={down} />}
    </svg>
  );
}
