// Types for build/bundle.json (contract: docs/PRD.md §5, schema/lens-card.schema.json).
// Exact numbers are SymPy strings such as "39/2": display them, never re-compute them.

export type ExactNumber = string;

export type LensId =
  | 'enclose'
  | 'slide'
  | 'unfold'
  | 'freeze'
  | 'balance'
  | 'area'
  | 'mirror'
  | 'constant';

export type CardKind = 'standard' | 'failure' | 'no_lens';
export type CardStatus = 'draft' | 'verified' | 'reviewed' | 'published';
export type Stage = 'shogakko' | 'chugaku' | 'koko' | 'daigaku';
export type Grade = '小4' | '小5' | '小6' | '中1' | '中2' | '中3' | '高1' | '高2' | '高3' | '大学';

export type StepOp = 'start' | 'add' | 'sub' | 'result' | 'note';

/** Verified geometry for an Enclose step (bundle 1.1). Scenes draw marks from these numbers. */
export type StepDetail =
  | { kind: 'box'; width: number; height: number }
  | { kind: 'corner'; n: number; edge: string; corner: Point; base: number; height: number };

export interface Step {
  ja: string;
  value?: ExactNumber;
  op?: StepOp;
  detail?: StepDetail;
}

export interface Route {
  steps: Step[];
  time_cost_sec: number;
  time_source: 'estimate' | 'tester_median';
}

/** A variant carries only its own lens steps; trap timing stays on the parent card. */
export interface VariantRoute {
  steps: Step[];
}

export type Point = [number, number];

export interface Grid {
  width: number;
  height: number;
  cell_cm: number;
}

export interface GridPolygonFigure {
  type: 'grid_polygon';
  grid: Grid;
  /** Counter-clockwise; labels A, B, C... follow this order. */
  points: Point[];
}

/** Two parallel lines ℓ (top) and m (bottom), `band_height` apart, with triangles between them. */
export interface ParallelBandFigure {
  type: 'parallel_band';
  band_height: number;
  /** x of A, B, C, D… on m. Triangle i has base bottom_x[i]..bottom_x[i+1] and apex apex_x[i] on ℓ. */
  bottom_x: number[];
  apex_x: number[];
  point_labels: { bottom: string[]; apex: string[] };
  /** Which lengths the problem gives; only these may be marked. */
  shown: { total_base: boolean; band_height: boolean; each_base: boolean };
  /** AD as an exact string, added by the validator so scenes never subtract coordinates. */
  total_base: ExactNumber;
  /** WO-018 failure card: ℓ is not parallel to m; apex i sits this high above m (drawn on a tilted ℓ). */
  apex_heights?: number[];
  /** WO-018 L4: the gap is asked (「?cm」 until the answer); the total shaded area is given. */
  ask?: 'band_height';
  total_area?: ExactNumber;
}

/**
 * A straight river (line ℓ) with P and Q on the same side; A and B are the feet of the
 * perpendiculars. The touch point X is drawn at the card's answer (AX), never computed.
 */
export interface MirrorPathFigure {
  type: 'mirror_path';
  ab: number;
  pa: number;
  qb: number;
  unit: string;
  point_labels: { P: string; Q: string; A: string; B: string; X: string; Q_reflected: string };
  /** WO-018 no-lens card: Q is on the other side of the river (below it); no reflection needed. */
  side?: 'opposite';
}

/**
 * WO-018 折り返す L4: lines ℓ (horizontal) and m (vertical) meet at right angles at O; P and Q lie in
 * that corner, [distance from m, distance from ℓ]. The path touches m, then ℓ. The touch point on ℓ
 * is drawn at the card's answer (its distance from O), never computed.
 */
export interface MirrorCornerFigure {
  type: 'mirror_corner';
  P: [number, number];
  Q: [number, number];
  unit: string;
}

/**
 * WO-018 折り返す failure card: a river of width w between a north and a south bank; P is pa above
 * the north bank (foot A), Q is qb below the south bank (foot B); A to B along the banks is ab. The
 * bridge (perpendicular to the banks) is drawn at the card's answer (its distance from A).
 */
export interface RiverBridgeFigure {
  type: 'river_bridge';
  pa: number;
  qb: number;
  ab: number;
  w: number;
  unit: string;
}

/**
 * A cuboid ABCD-EFGH (E above A, F above B, G above C): AB = a, BC = b, AE = h. A string on the
 * surface runs A → P (on edge BF) → G. P is drawn at the card's answer (BP), never computed;
 * `net_width` (a + b) comes from the validator.
 */
export interface BoxUnfoldFigure {
  type: 'box_unfold';
  a: number;
  b: number;
  h: number;
  unit: string;
  point_labels: { A: string; B: string; C: string; D: string; E: string; F: string; G: string; H: string; P: string };
  net_width: string;
  /** Drawing coordinates from the validator (bundle, tokens 1.6 / #51); never printed. */
  mesh?: BoxMesh;
  /** WO-018 no-lens card: the path runs along the edges A→B→C→G; nothing opens. */
  path?: 'edges';
  /** WO-018 L4: A → P (on BF) → Q (on CG) → H over three faces; Q is drawn at the answer (CQ). */
  route?: 'three_faces';
  /** WO-018 failure card: the volume of the corner pyramid cut off at mesh.cut_off. WO-023 `length`: the string's length A–G. */
  ask?: 'corner_volume' | 'length';
}

export interface BoxMesh {
  units: string;
  vertices: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H', [number, number, number]>;
  faces: Record<string, string[]>;
  hinge: { edge: [string, string]; face: string; open_deg: number };
  net: Record<string, [number, number]>;
  path: { from: string; via_edge: [string, string]; to: string };
  /** WO-018 failure card (ask: corner_volume): the cut's vertices (e.g. B, D, E) and the corner cut off (A). */
  cut?: string[];
  cut_off?: string;
}

/**
 * Which picture a word problem draws (bundle 1.3, WO-015) and the numbers that size it. Render by
 * `family`, not by kind. These numbers size and snap shapes only; the answer fields (x, w2, n, shift,
 * t) are strings and are never printed.
 */
export type WordDiagramSpec =
  | { family: 'area_two_rect'; unit: string; n: number; a: number; b: number; t: number; x: string }
  | { family: 'area_average'; w1: number; h1: number; h2: number; level: number; w2: string }
  | { family: 'area_shortfall'; a: number; b: number; s: number; d: number; n: string }
  | { family: 'diff_bars'; measure: 'age' | 'yen'; step: number; big: number; small: number; r: number; dir: 1 | -1; shift: string }
  | { family: 'lever'; unit_w: string; unit_p: string; w1: number; p1: number; p2: number; pt: number; w2: string }
  | { family: 'road'; mode: 'toward' | 'chase'; d: number; u: number; v: number; t: string }
  | { family: 'steps_only' };

export type WordFamily = WordDiagramSpec['family'];

/**
 * A word problem: the figure is a diagram the lens draws. `diagram.family` picks the picture; `params`
 * holds the problem's numbers and `names` its nouns. Printed numbers come only from params, the text
 * or the steps.
 */
export interface WordProblemFigure {
  type: 'word_problem';
  kind: 'two_kinds_total' | 'age_ratio' | 'mixture' | 'meeting' | 'average_groups' | 'shortfall' | 'age_ratio_past' | 'same_spend' | (string & {});
  params: Record<string, number>;
  names: Record<string, string>;
  diagram: WordDiagramSpec;
}

/** One stage of a chained problem: its lens, its slice of lens_route.steps [from, to] (inclusive), and its goal. */
export interface ChainStage {
  lens: LensId;
  steps: [number, number];
  goal_ja: string;
  snap?: string;
}

/** Stage 2 (ADR-004): a lattice polygon on a coordinate plane with axes through the origin. */
export interface CoordPolygonFigure {
  type: 'coord_polygon';
  points: Point[];
  unit?: string;
  min_slanted?: number;
  /**
   * `axis_base`: one side lies on the x-axis (the no-lens card); `quad`: a quadrilateral; `axis_diagonal`
   * (WO-023, the failure card): a quadrilateral whose diagonal lies on the y-axis (cut there, no box needed).
   */
  shape?: 'axis_base' | 'quad' | 'axis_diagonal';
}

/** Stage 2: P on the y-axis with △ABP = △ABC (P on the line through C parallel to AB); the answer is P's y. */
export interface CoordEqualAreaFigure {
  type: 'coord_equal_area';
  A: Point;
  B: Point;
  C: Point;
}

/**
 * Stage 2: P on the x-axis minimising AP + PB (reflect B across the x-axis). `ask: p_x` asks for P's x;
 * otherwise the chained card asks for △ABP. `side: opposite`: A and B already on opposite sides.
 * `ask: max_diff` (the failure card): P maximises |PA − PB|, on line AB extended (no reflection).
 */
export interface CoordMirrorAreaFigure {
  type: 'coord_mirror_area';
  A: Point;
  B: Point;
  unit?: string;
  min_slanted?: number;
  ask?: 'p_x' | 'max_diff';
  side?: 'opposite';
}

/**
 * WO-023 (Stage 2): P on the y-axis with △ABP of area S, cut along the y-axis at Q (AB ∩ y-axis).
 * `origin: true`: △OPA with O the origin (OP is on the axis; B is absent). The answer is P's y.
 */
export interface CoordYSplitFigure {
  type: 'coord_y_split';
  A: Point;
  B?: Point;
  S: number;
  origin?: boolean;
  unit?: string;
}

/**
 * WO-023 (Stage 2): quadrilateral ABCD with A, B on the x-axis; C slides parallel to DB to E on the
 * x-axis, so △AED = ABCD. The answer is E's x.
 */
export interface CoordQuadTriFigure {
  type: 'coord_quad_tri';
  A: Point;
  B: Point;
  C: Point;
  D: Point;
  unit?: string;
}

/** A quadratic y = ax² + bx + c as [a, b, c] (a may be 0 for a line). Numbers may be fractions ("1/2"). */
export type Quadratic = [number, number, number];

/**
 * WO-023 囲む (tools/stage3.py): the region between y = f and y = g (the x-axis when g is absent), area by the
 * 1/6 formula. `bounds` [p, q]: the failure / no-lens cards, bounded by x = p and x = q instead of crossings.
 */
export interface ParabolaAreaFigure {
  type: 'parabola_area';
  f: Quadratic;
  g?: Quadratic;
  bounds?: [number, number];
}

/**
 * WO-023 等積変形: y = ax² with A (x = alpha) and B (x = beta); P on the parabola. `px` / `max_area`: P where the
 * tangent ∥ AB; `equal_o`: △ABP = △ABO (P on the parallel through O); `range_max`: P limited to `range`
 * (failure); `oab`: △OAB directly (no-lens).
 */
export interface ParabolaTriFigure {
  type: 'parabola_tri';
  a: number | string;
  alpha: number;
  beta: number;
  ask: 'px' | 'max_area' | 'equal_o' | 'range_max' | 'oab';
  range?: [number, number];
}

/**
 * WO-023 折り返す: ℓ: y = mx + k (`line` [m, k]), A and B; P on ℓ minimising AP + PB (reflect B to B′). `max_diff`
 * (failure): |PA − PB| is largest on line AB; `side: opposite` (no-lens): A and B already on opposite sides.
 */
export interface LineMirrorFigure {
  type: 'line_mirror';
  line: [number, number];
  A: Point;
  B: Point;
  ask: 'p_x' | 'min_len' | 'max_diff';
  side?: 'opposite';
}

/**
 * WO-023 止める: a family through a fixed point. `line`: c = [[p1, q1], [p2, q2], [p3, q3]] for
 * (p1·a + q1)x + (p2·a + q2)y + (p3·a + q3) = 0; `parabola`: c = [[p, q], [r, s]] for y = x² + (p·a + q)x + (r·a + s).
 * `a_for_point` (failure): the a through `point`; `slope_at` (no-lens): the slope at a = `a0`.
 */
export interface ParamFamilyFigure {
  type: 'param_family';
  family: 'line' | 'parabola';
  c: number[][];
  ask?: 'point' | 'a_for_point' | 'slope_at';
  point?: Point;
  a0?: number;
}

/**
 * WO-023 展開: a cone (base radius r, slant l) opened into a sector of angle 360r/l. `loop`: A round to A′;
 * `to_point`: A round to B′ (OB′ = d); `side_area` (no-lens). `expect: through_apex` (failure): the sector is
 * 180° or more, so the shortest path goes through the apex O.
 */
export interface ConeUnfoldFigure {
  type: 'cone_unfold';
  r: number;
  l: number;
  ask: 'loop' | 'to_point' | 'side_area';
  d?: number;
  expect?: 'through_apex';
  angles?: number[];
}

export type DiceOp = 'sum_le' | 'sum_eq' | 'diff_ge' | 'prod_le' | 'prod_mult' | 'both_even' | 'both_le' | 'both_ge' | 'even_le';

/** WO-023 面積図: two dice as a 6×6 table (big die across, small down); `dice: 3` is the failure card. */
export interface DiceGridFigure {
  type: 'dice_grid';
  dice?: 2 | 3;
  cond: { op: DiceOp; k?: number };
  expect?: 'three_dice';
}

/**
 * WO-023 差一定: px + qy = s (p, q default 1). `max_product` (with `shift` [u, v]: (x + u)(y + v)), `min_squares`;
 * `x_min` (failure): x ≧ x_min past the centre; `given_diff` (no-lens): x − y = d also given.
 */
export interface ConstSumFigure {
  type: 'const_sum';
  s: number;
  p?: number;
  q?: number;
  ask: 'max_product' | 'min_squares' | 'given_diff';
  shift?: [number, number];
  x_min?: number;
  d?: number;
}

/** Stage 3: △ABC with D on BC (BD:DC) and E on CA (CE:EA); AD and BE meet at P (mass points). */
export interface TriangleCeviansFigure {
  type: 'triangle_cevians';
  bd: number;
  dc: number;
  ce: number;
  ea: number;
  ask?: 'ap_pd' | 'bp_pe' | 'area_pbc' | 'area_abd';
}

/** Figures with a scene. Other types in the bundle (later lenses' drafts) have none yet. */
export type Figure =
  | GridPolygonFigure
  | ParallelBandFigure
  | MirrorPathFigure
  | MirrorCornerFigure
  | RiverBridgeFigure
  | WordProblemFigure
  | BoxUnfoldFigure
  | CoordPolygonFigure
  | CoordEqualAreaFigure
  | CoordMirrorAreaFigure
  | CoordYSplitFigure
  | CoordQuadTriFigure
  | TriangleCeviansFigure
  | ParabolaAreaFigure
  | ParabolaTriFigure
  | LineMirrorFigure
  | ParamFamilyFigure
  | ConeUnfoldFigure
  | DiceGridFigure
  | ConstSumFigure;

export interface Picker {
  /** Exactly four move ids, e.g. "enclose" or "direct". */
  options: string[];
  correct: string;
  /** Decoy clue tags that point to a different move (schema 1.1). */
  clue_distractors: string[];
  feedback_ja: Record<string, string>;
}

export interface Variant {
  id: string;
  /** grid_polygon variants. */
  points?: Point[];
  grid?: Grid;
  /** Other figure types carry their own figure fields (a partial figure) and sentence. */
  figure?: Partial<Figure>;
  text_ja?: string;
  answer: ExactNumber;
  /** Stage 3 answers that are not plain numbers (「8√2cm」, 「15πcm²」, 「(2, −1)」). */
  display_ja?: string;
  lens_route: VariantRoute;
}

export interface Check {
  type:
    | 'area_equals_answer'
    | 'route_steps_sum'
    | 'enclose_clean'
    | 'enclose_not_clean'
    | 'has_horizontal_base'
    | 'tilted_square'
    | 'lattice_only'
    | 'simple_polygon'
    | 'lens_faster';
  route?: 'trap_route' | 'lens_route';
  note?: string;
}

export interface LensCard {
  schema_version: string;
  id: string;
  kind: CardKind;
  lens: LensId;
  best_move?: string;
  /** 1–4, labels in pass.levels (bundle 1.3). */
  level?: number;
  archetype?: string;
  stage: Stage;
  grades: Grade[];
  status: CardStatus;
  provenance: {
    original: true;
    built_from: string;
    not_derived_from: string;
    author?: string;
    reviewed_by?: string;
  };
  grounding?: {
    principle_ja: string;
    principle_en: string;
  };
  problem: {
    text_ja: string;
    unit: string;
    figure: Figure;
  };
  answer: {
    value: ExactNumber;
    display_ja?: string;
    expr: 'polygon_area' | (string & {});
  };
  trap_route: Route;
  lens_route: Route;
  /** ADR-003 §2: a chained-lens problem plays stage by stage on one figure (Stage 2+). */
  chain?: ChainStage[];
  trigger: {
    ja: string;
    en?: string;
    tags: string[];
  };
  fails_when?: string;
  picker: Picker;
  animation?: {
    keyframes: string[];
  };
  checks: Check[];
  /** In the bundle, the YAML generator config is replaced by the generated variants. */
  variants: Variant[];
}

// ---- tokens/tokens.json ----

export interface ColorToken {
  value: string;
  print?: string;
  note?: string;
}

export interface LensColorToken extends ColorToken {
  icon: string;
}

export interface StrokeToken {
  width: number;
  dash: string;
  every?: number;
  note?: string;
}

export interface TypeScaleToken {
  size: number;
  weight: number;
  line: number;
  family?: 'family_ja' | 'family_num' | 'family_hand';
}

export interface Tokens {
  version: string;
  color: {
    paper: ColorToken;
    ink: ColorToken;
    ink_quiet: ColorToken;
    grid: ColorToken;
    trap: { ink: ColorToken; tint: ColorToken; flag: ColorToken };
    lens: { note?: string } & Record<LensId | 'direct', LensColorToken>;
    lens_tint_opacity: number;
    correct: ColorToken;
    miss: ColorToken;
    step: {
      /** One colour per calculation step (corner 1, 2, 3, 4…), always paired with a numbered badge. */
      palette: ColorToken[];
      tint_opacity: number;
    };
    /** Course-player surfaces and the countable grid (tokens 1.6; set in the short_dark theme). */
    panel?: ColorToken;
    raise?: ColorToken;
    line?: ColorToken;
    grid_minor?: ColorToken;
    grid_major?: ColorToken;
  };
  stroke: {
    unit: string;
    grid: StrokeToken;
    grid_major: StrokeToken;
    figure: StrokeToken;
    trap: StrokeToken;
    lens: StrokeToken;
    lens_construction: StrokeToken;
    cap: 'round' | 'butt' | 'square';
    join: 'round' | 'miter' | 'bevel';
  };
  type: {
    family_ja: string;
    family_num: string;
    family_hand: string;
    scale: Record<
      'display' | 'title' | 'problem' | 'step' | 'scratch' | 'label' | 'trigger',
      TypeScaleToken
    >;
    screen_min_px: number;
  };
  time_cost: {
    unit: 'seconds';
    bar_height: number;
    scale_sec_per_mm: number;
    trap_label_ja: string;
    lens_label_ja: string;
    saved_label_ja: string;
    source_badge: Record<Route['time_source'], string>;
  };
  layout: {
    trainer: {
      max_width_px: number;
      figure_min_px: number;
      tap_target_px: number;
      gutter_px: number;
    };
    short: ShortLayout;
  };
  motion: {
    duration_ms: {
      draw_line: number;
      shade: number;
      count_up: number;
      pause_after_reveal: number;
      laser_wipe: number;
      corner_fill: number;
      corner_stagger: number;
      corner_remove: number;
      core_reveal: number;
      hold_answer: number;
    };
    easing: string;
    spring: SpringToken;
    study: {
      step_focus_ms: number;
      legs_draw_ms: number;
      formula_ms: number;
      step_hold_ms: number;
      dim_others_opacity: number;
      equation_term_ms: number;
      final_hold_ms: number;
    };
    reduce_motion: string;
    /** Founder MVP feel (tokens 1.6): springs (stiffness k, damping c) and guide timings. */
    tactile?: TactileToken;
    masterclass?: MasterclassToken;
  };
  themes?: Record<string, ThemeOverride>;
}

/** Study-pace Short layout, in px on the 1080×1920 frame (tokens 1.3). */
export interface ShortLayout {
  size_px: [number, number];
  fps: number;
  safe_top_px: number;
  safe_bottom_px: number;
  regions: {
    title_band: { y: number; height: number };
    figure: { y: number; max_width: number; max_height: number; centre_x: number; min_margin_px: number };
    formula_card: { centre_y: number; width: number; height: number };
    equation: { baseline_y: number; align: string };
  };
  type_px: {
    step_title: number;
    badge: number;
    lens_chip: number;
    vertex_label: number;
    bracket_number: number;
    formula: number;
    equation: number;
    answer: number;
    trigger: number;
    trap_text: number;
  };
  pieces: {
    current: {
      fill_opacity: number;
      stroke_width: number;
      /** Diagonal stripes in the full step colour over the faint tint (tokens 1.4). */
      stripes?: { angle_deg: number; stripe_px: number; period_px: number; opacity: number };
    };
    done: { fill_opacity: number; stroke_opacity: number; stroke_width: number; draw_above_box: boolean };
    upcoming: { stroke_opacity: number; stroke_width: number };
  };
  brackets: { offset_px: number; tick_px: number };
  equation_terms: { future_placeholder: string; future_opacity: number };
  trap_text_min_opacity: number;
}

export interface SpringToken {
  damping: number;
  stiffness: number;
  mass: number;
}

export interface GlowToken {
  blur_px: number;
  opacity: number;
  pulse_period_ms: number;
  pulse_min_opacity: number;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** A theme lists only what it changes; everything else falls back to the base tokens. */
export interface SpringKC {
  k: number;
  c: number;
}

export interface TactileToken {
  snap: SpringKC;
  fold: SpringKC;
  settle: SpringKC;
  idle_ms: number;
  halo_ms: number;
  halo_repeats: number;
  finger_ms: number;
  finger_repeats: number;
  aha_step_stagger_ms: number;
  confetti_particles: number;
}

export interface ThemeOverride {
  color?: DeepPartial<Tokens['color']>;
  lens_tint_opacity?: number;
  glow?: GlowToken;
}

export interface LensLabel {
  ja: string;
  hint_ja: string;
}

export interface TagLabel {
  ja: string;
  generic?: boolean;
}

/** One lesson of a Pass: a lens and its cards in catalog order (bundle 1.3). */
export interface Lesson {
  lens: LensId;
  video: string;
  cards: string[];
  /** Step 1, the 6-minute masterclass (WO-014, bundle 1.8). */
  masterclass?: Masterclass;
}

/** One lesson's masterclass content (WO-014): card ids, the boundary sentence and ナゼホリ's lines. */
export interface Masterclass {
  example1: string;
  example2: string;
  boundary: string;
  try: string;
  example2_mode: 'scene' | 'walkthrough';
  boundary_line: string;
  /** Tag ids from example1's trigger: the words to look for. */
  clues: string[];
  title: Record<'principle' | 'example1' | 'example2' | 'boundary' | 'onboarding', string>;
  say: Record<'principle' | 'principle_turn' | 'principle_lens' | 'example1' | 'example1_done' | 'example2' | 'example2_done' | 'boundary' | 'onboarding' | 'onboarding_done', string>;
  /** WO-022: the mascot's clip per `say` key (only clips matching the current line; absent until recorded). */
  audio?: Partial<Record<string, string>>;
}

/** The masterclass standard (tokens 1.8, motion.masterclass): beats and their target seconds. */
export interface MasterclassToken {
  total_sec: number;
  core_sec: number;
  beats: { id: MasterBeatId; ja: string; sec: number; part: 'core' | 'onboarding' }[];
  practice_round: number;
  trap_line_stagger_ms: number;
  lens_step_min_ms: number;
}

export type MasterBeatId = 'principle' | 'example1' | 'example2' | 'boundary' | 'onboarding';

/** A Pass (ADR-001). Planned Passes have no lessons yet. */
export interface Pass {
  id: string;
  stage_no: number;
  title_ja: string;
  audience_ja: string;
  card_stages: string[];
  status: string;
  sku: string;
  price_jpy?: number;
  early_price_jpy?: number;
  founder_seats?: number;
  term_months?: number;
  devices?: number;
  lesson_target?: number;
  levels?: Record<string, string>;
  lessons: Lesson[];
}

export interface Bundle {
  bundle_version: string;
  schema_version: string;
  tokens: Tokens;
  /** Picker and clue labels (bundle 1.2). */
  labels: {
    lenses: Record<string, LensLabel>;
    tags: Record<string, TagLabel>;
  };
  /** Passes and their lessons (bundle 1.3). */
  passes?: Pass[];
  /** Status verified or later, sorted by lens then id. */
  cards: LensCard[];
}
