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
}

/** Figures with a scene. Other types in the bundle (later lenses' drafts) have none yet. */
export type Figure = GridPolygonFigure | ParallelBandFigure | MirrorPathFigure;

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
    expr: 'polygon_area';
  };
  trap_route: Route;
  lens_route: Route;
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

export interface Bundle {
  bundle_version: string;
  schema_version: string;
  tokens: Tokens;
  /** Picker and clue labels (bundle 1.2). */
  labels: {
    lenses: Record<string, LensLabel>;
    tags: Record<string, TagLabel>;
  };
  /** Status verified or later, sorted by lens then id. */
  cards: LensCard[];
}
