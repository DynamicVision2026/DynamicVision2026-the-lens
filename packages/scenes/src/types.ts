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

export interface Step {
  ja: string;
  value?: ExactNumber;
  op?: StepOp;
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

export interface Picker {
  /** Exactly four move ids, e.g. "enclose" or "direct". */
  options: string[];
  correct: string;
  feedback_ja: Record<string, string>;
}

export interface Variant {
  id: string;
  points: Point[];
  grid: Grid;
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
  schema_version: '1.0';
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
    figure: GridPolygonFigure;
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
    short: {
      size_px: [number, number];
      fps: number;
      safe_top_px: number;
      safe_bottom_px: number;
    };
  };
  motion: {
    duration_ms: {
      draw_line: number;
      shade: number;
      count_up: number;
      pause_after_reveal: number;
    };
    easing: string;
    reduce_motion: string;
  };
}

export interface Bundle {
  bundle_version: string;
  schema_version: string;
  tokens: Tokens;
  /** Status verified or later, sorted by lens then id. */
  cards: LensCard[];
}
