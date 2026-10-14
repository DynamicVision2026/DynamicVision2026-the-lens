import { partialPolyline } from '../geometry';
import type { UnfoldLayout } from '../unfold';
import type { BoxUnfoldFigure, Point, Tokens } from '../types';
import { Bracket } from './Bracket';

export interface UnfoldFigureProps {
  fig: BoxUnfoldFigure;
  layout: UnfoldLayout;
  /** BP, read from the card's answer: P is drawn here, never computed. */
  crossY: number;
  /** Printed beside BP once the answer is shown (display_ja, or the exact value + unit). */
  answerText: string;
  tokens: Tokens;
  ink: string;
  chalk: string;
  accent: string;
  palette: string[];
  font: string;
  weight: number;
  labelSize: number;
  figureStroke: number;
  lensStroke: number;
  dash: string;
  bracket: { offset: number; tick: number; numberSize: number; strokeWidth: number };
  show: number;
  /** The midpoint guess on the box: drawn on (0–1), then dimmed to `tryDim`. */
  tryPath: number;
  tryDim: number;
  /** Face BCGF swinging open around BF: 0 the box, 1 the flat net. */
  unfold: number;
  /** A→G drawn on across the net; P lights where it crosses BF. */
  straight: number;
  /** Triangles ABP and ACG in two step colours. */
  similar: number;
  answer: number;
  tint: number;
  /** Paper colour for the halo behind the P label (keeps it readable over the stripes). */
  halo?: string;
  stripes?: { angle_deg: number; stripe_px: number; period_px: number; opacity: number };
  idPrefix: string;
  glowFilter?: string;
  glowOpacity?: number;
}

type XY = [number, number];

/** The cuboid in cabinet projection; the lens opens face BCGF flat beside ABFE along BF. */
export function UnfoldFigure(p: UnfoldFigureProps) {
  const { fig, layout: L, ink, accent, labelSize: size } = p;
  if (p.show <= 0) return null;
  const { a, b, h } = fig;
  const labels = fig.point_labels;
  // WO-018 no-lens card: the path runs along the edges, so nothing opens; draw_straight traces A→B→C→G.
  const edges = fig.path === 'edges';
  const unfold = edges ? 0 : p.unfold;
  const box = L.depth(0);
  const open = L.depth(unfold);
  const at = (x: number, y: number) => L.at(x, y);
  const back = (x: number, y: number, d: [number, number]) => at(x + b * d[0], y + b * d[1]);
  const A = at(0, 0);
  const B = at(a, 0);
  const F = at(a, h);
  const E = at(0, h);
  const D = back(0, 0, box);
  const H = back(0, h, box);
  const C = back(a, 0, open);
  const G = back(a, h, open);
  const G0 = back(a, h, box);
  const M = at(a, h / 2);
  const P = at(a, p.crossY);
  const boxOnly = 1 - unfold;
  // The box's corners by name, for the corner-volume cut (drawing positions only).
  const corner: Record<string, XY> = { A, B, C: back(a, 0, box), D, E, F, G: G0, H };
  const cut = fig.mesh?.cut?.map((k) => corner[k]).filter((q): q is XY => !!q);
  const cutOff = fig.mesh?.cut_off ? corner[fig.mesh.cut_off] : undefined;
  const len = (v: number | string) => `${v}${fig.unit}`;
  const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
  // Where A→G crosses BF on the net, as a fraction of the segment (drawing only: P itself comes from the answer).
  const crossAt = a / (a + b);
  const straightPath = partialPolyline([A, G] as Point[], p.straight) as XY[];
  const pLit = p.straight >= crossAt ? Math.min(1, ((p.straight - crossAt) / Math.max(1e-6, 1 - crossAt)) * 2) : 0;
  // Brackets sit below the corner labels.
  const drop = p.bracket.offset + size * 1.2;
  const bk = { tokens: p.tokens, tick: p.bracket.tick, numberSize: p.bracket.numberSize, strokeWidth: p.bracket.strokeWidth };
  // ACG is the whole outer triangle (outline + light tint); ABP sits inside it, striped where stripes are on.
  const tri = (ps: XY[], i: number, striped: boolean, tint: number) => {
    const c = p.palette[i % p.palette.length]!;
    const id = `${p.idPrefix}-unfold-${i}`;
    return (
      <g key={i} opacity={p.similar}>
        {striped && p.stripes && (
          <defs>
            <pattern id={id} patternUnits="userSpaceOnUse" width={p.stripes.period_px} height={p.stripes.period_px} patternTransform={`rotate(${p.stripes.angle_deg})`}>
              <rect x={0} y={0} width={p.stripes.stripe_px} height={p.stripes.period_px} fill={c} />
            </pattern>
          </defs>
        )}
        <polygon points={pts(ps)} fill={c} fillOpacity={tint} stroke="none" />
        {striped && p.stripes && <polygon points={pts(ps)} fill={`url(#${id})`} opacity={p.stripes.opacity} stroke="none" />}
      </g>
    );
  };
  const outline = (ps: XY[], i: number, width: number) => (
    <polygon points={pts(ps)} fill="none" stroke={p.palette[i % p.palette.length]} strokeWidth={width} strokeLinejoin="round" opacity={p.similar} />
  );
  const dot = (q: XY, c: string, o = 1) => <circle cx={q[0]} cy={q[1]} r={p.figureStroke * 2.2} fill={c} opacity={o} />;
  const label = (q: XY, text: string, dx: number, dy: number, o = 1, c = ink) =>
    o > 0 ? (
      <text x={q[0] + dx * size} y={q[1] + dy * size} fill={c} opacity={o} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    ) : null;

  return (
    <g opacity={p.show}>
      {/* Similar triangles first, under the lines: ACG, then ABP on top. */}
      {!edges && tri([A, C, G], 1, false, p.tint * 0.5)}
      {!edges && tri([A, B, P], 0, true, p.tint)}

      {/* The parts of the box that are not on the net fade as the face opens. */}
      {boxOnly > 0 && (
        <g opacity={boxOnly}>
          <polyline points={pts([E, H, G0, F])} fill="none" stroke={ink} strokeWidth={p.figureStroke} strokeLinejoin="round" />
          <g stroke={ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} fill="none">
            <line x1={A[0]} y1={A[1]} x2={D[0]} y2={D[1]} />
            <line x1={D[0]} y1={D[1]} x2={back(a, 0, box)[0]} y2={back(a, 0, box)[1]} />
            <line x1={D[0]} y1={D[1]} x2={H[0]} y2={H[1]} />
          </g>
          {label(D, labels.D, -0.6, -0.7)}
          {label(H, labels.H, -0.6, -0.7)}
          {label([(B[0] + C[0]) / 2, (B[1] + C[1]) / 2], len(b), 0.7, 1.1, Math.max(0, 1 - unfold * 3))}
        </g>
      )}

      {/* WO-018 corner-volume card: the cut through mesh.cut (B, D, E) shaded, and the corner it cuts off marked. */}
      {cut && boxOnly > 0 && (
        <g data-part="cut" opacity={boxOnly}>
          <polygon points={pts(cut)} fill={p.palette[2 % p.palette.length]} fillOpacity={p.tint * 2} stroke={accent} strokeWidth={p.lensStroke} strokeLinejoin="round" />
          {cutOff && (
            <g data-part="cut-off">
              <circle cx={cutOff[0]} cy={cutOff[1]} r={size * 0.7} fill="none" stroke={accent} strokeWidth={p.figureStroke * 1.5} />
              {dot(cutOff, accent)}
            </g>
          )}
        </g>
      )}

      {/* Face ABFE and the hinged face BCGF (a parallelogram on the box, a rectangle on the net). */}
      <polygon points={pts([A, B, F, E])} fill="none" stroke={ink} strokeWidth={p.figureStroke} strokeLinejoin="round" />
      <polygon points={pts([B, C, G, F])} fill={accent} fillOpacity={p.tint * 0.6 * Math.min(1, unfold * 4) * (1 - p.similar)} stroke={ink} strokeWidth={p.figureStroke} strokeLinejoin="round" />
      {/* BF, the hinge, in the lens colour while the face opens. */}
      {unfold > 0 && <line x1={B[0]} y1={B[1]} x2={F[0]} y2={F[1]} stroke={accent} strokeWidth={p.lensStroke} opacity={Math.min(1, unfold * 4)} />}

      {/* Given lengths: AB below, AE on the left; BC below it on the net, then the net's width. */}
      <Bracket from={A} to={B} normal={[0, 1]} label={len(a)} color={ink} offset={drop} {...bk} />
      {label([(A[0] + E[0]) / 2, (A[1] + E[1]) / 2], len(h), -1.6, 0)}
      {unfold > 0.6 && (
        <g opacity={(unfold - 0.6) / 0.4}>
          <Bracket from={B} to={C} normal={[0, 1]} label={len(b)} color={ink} offset={drop} {...bk} />
        </g>
      )}
      {unfold > 0.8 && (
        <g opacity={(unfold - 0.8) / 0.2}>
          <Bracket from={A} to={C} normal={[0, 1]} label={len(fig.net_width)} color={accent} offset={drop + p.bracket.numberSize * 2.2} {...bk} />
        </g>
      )}

      {/* Edges only: A → B → C → G along the box, in the lens colour. */}
      {edges && p.straight > 0 && (
        <polyline points={pts(partialPolyline([A, B, C, G] as Point[], p.straight) as XY[])} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* The trap: the middle of BF. */}
      {!edges && p.tryPath > 0 && (
        <g opacity={p.tryDim}>
          <polyline points={pts(partialPolyline([A, M, G] as Point[], p.tryPath) as XY[])} fill="none" stroke={p.chalk} strokeWidth={p.figureStroke * 1.5} strokeDasharray={p.dash} strokeLinejoin="round" />
          {p.tryPath >= 0.5 && (
            <g data-part="midpoint" data-y={M[1]}>
              <circle cx={M[0] - size * 1.4} cy={M[1] - size * 1.4} r={size * 0.75} fill="none" stroke={p.chalk} strokeWidth={p.figureStroke} />
              {label([M[0] - size * 1.4, M[1] - size * 1.4], '?', 0, 0, 1, p.chalk)}
              {dot(M, p.chalk)}
            </g>
          )}
        </g>
      )}

      {/* The straight line A→G on the net, P where it crosses BF. */}
      {!edges && p.straight > 0 && (
        <g>
          {p.glowFilter && <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinecap="round" />
        </g>
      )}

      {/* The two similar triangles' outlines, above the edges: ABP, then the whole of ACG. */}
      {!edges && p.similar > 0 && outline([A, B, P], 0, p.lensStroke)}
      {!edges && p.similar > 0 && outline([A, C, G], 1, p.lensStroke)}

      {/* CG (= AE) beside the similar triangles; BP once the answer is shown. */}
      {!edges && label([(C[0] + G[0]) / 2, (C[1] + G[1]) / 2], len(h), 1.6, 0, p.similar)}
      {!edges && label([(B[0] + P[0]) / 2, (B[1] + P[1]) / 2], p.answerText, -1.7, 0, p.answer, accent)}

      {/* Points and their labels. */}
      {[A, B, E, F].map((q, i) => <g key={i}>{dot(q, ink)}</g>)}
      {dot(C, ink)}
      {dot(G, ink)}
      {label(A, labels.A, -0.9, 0)}
      {label(B, labels.B, -0.6, -0.6)}
      {label(E, labels.E, -0.8, -0.7)}
      {label(F, labels.F, -0.6, -0.8)}
      {label(C, labels.C, 0.9, 0)}
      {label(G, labels.G, 0.8, -0.7)}
      {/* P last, with a paper halo so the stripes never cover it. */}
      {!edges && pLit > 0 && (
        <g data-part="cross" data-y={P[1]}>
          {dot(P, accent, pLit)}
          {p.halo && (
            <text x={P[0] + 0.8 * size} y={P[1] + 0.6 * size} fill="none" stroke={p.halo} strokeWidth={size * 0.25} strokeLinejoin="round" opacity={pLit} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
              {labels.P}
            </text>
          )}
          {label(P, labels.P, 0.8, 0.6, pLit, accent)}
        </g>
      )}
    </g>
  );
}
