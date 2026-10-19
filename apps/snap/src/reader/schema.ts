import { z } from "zod";
import { type Grade, isGrade, readerUnitsForGrade } from "../curriculum";

export const MARKS = ["○", "✕"] as const;
export type Mark = (typeof MARKS)[number] | null;

const OK_WORDS = ["○", "〇", "◯", "o", "correct", "right", "true", "ok", "maru", "まる", "マル", "丸", "正解", "正", "せいかい"];
const WRONG_WORDS = ["✕", "×", "✗", "✖", "x", "wrong", "incorrect", "false", "ng", "batsu", "batu", "ばつ", "バツ", "不正解", "誤", "誤り"];

/**
 * Normalise the many ways a model may write a mark or a judgment ("正解", "maru", "×" …).
 * A check mark (✓) is deliberately not mapped: Japanese teachers use it for both meanings.
 */
export function normMark(v: unknown): Mark {
  if (v === null || v === undefined || typeof v === "object") return null;
  if (v === true) return "○";
  if (v === false) return "✕";
  const s = String(v).trim().toLowerCase();
  if (OK_WORDS.includes(s)) return "○";
  if (WRONG_WORDS.includes(s)) return "✕";
  return null;
}

/** Default unit confidence when the model leaves it out (older outputs, recorded fixtures). */
export const DEFAULT_UNIT_CONFIDENCE = 0.8;

const nullableString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined || v === "" ? null : String(v)));

export const ProblemSchema = z.object({
  n: z.number().int().positive(),
  q: z.string(),
  unit: z.string().nullable(),
  answer: z.string().nullable(),
  mark: z.enum(MARKS).nullable(),
  confidence: z.number().min(0).max(1),
  /** How sure the reader is of the unit (not of the reading). */
  unitConfidence: z.number().min(0).max(1).default(DEFAULT_UNIT_CONFIDENCE),
  /** Second-best unit id from the page's allowed list, or null. */
  unitAlt: z.string().nullable().default(null),
  /** The answer the AI computed (short, same units as the problem). */
  correctAnswer: z.string().nullable().default(null),
  /** The AI's own ○/✕ of the student's answer; separate from the teacher's red mark. */
  judge: z.enum(MARKS).nullable().default(null),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const PageResultSchema = z.object({
  pageType: z.enum(["test", "drill", "note", "other"]),
  gradeGuess: z.string().nullable(),
  score: z.string().nullable(),
  retake: z.boolean(),
  problems: z.array(ProblemSchema),
  notes: z.string(),
});
export type PageResult = z.infer<typeof PageResultSchema>;

/** 0–1 number or undefined (null, "", NaN, out of range → undefined, so the default applies). */
const optionalUnitNumber = z
  .preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().min(0).max(1).optional())
  .catch(undefined);

/** Lenient input shape: accepts the model's snake_case JSON or our camelCase. */
const RawProblem = z.object({
  n: z.coerce.number().int().positive().optional(),
  q: z.string().default(""),
  unit: nullableString,
  answer: nullableString,
  mark: z.unknown().transform(normMark),
  confidence: z.coerce.number().min(0).max(1).catch(0.5).default(0.5),
  unitConfidence: optionalUnitNumber,
  unit_confidence: optionalUnitNumber,
  unitAlt: nullableString.optional(),
  unit_alt: nullableString.optional(),
  correctAnswer: nullableString.optional(),
  correct_answer: nullableString.optional(),
  judge: z.unknown().transform(normMark),
});
const RawPage = z
  .object({
    pageType: z.string().optional(),
    page_type: z.string().optional(),
    gradeGuess: nullableString.optional(),
    grade_guess: nullableString.optional(),
    score: nullableString.optional(),
    retake: z.boolean().optional(),
    problems: z.array(RawProblem).default([]),
    notes: z.string().nullable().optional(),
  })
  .passthrough();

const PAGE_TYPES = ["test", "drill", "note", "other"] as const;

/**
 * Validate a raw reader output and bind it to the grade:
 * - problems renumbered by order on the page (a red ✕ often hides the printed number)
 * - a unit that is not in the grade's reader list becomes null (the user picks)
 * - unit_alt must be in the same list and differ from unit, else null
 * - judge strings ("正解", "maru", "×" …) → ○ / ✕ / null
 */
export function toPageResult(raw: unknown, grade: Grade): PageResult {
  const p = RawPage.parse(raw);
  const allowed = new Set(readerUnitsForGrade(grade).map((u) => u.id));
  const pt = (p.pageType ?? p.page_type ?? "other") as string;
  const gg = p.gradeGuess ?? p.grade_guess ?? null;
  const result: PageResult = {
    pageType: (PAGE_TYPES as readonly string[]).includes(pt) ? (pt as PageResult["pageType"]) : "other",
    gradeGuess: gg && (isGrade(gg) || gg.length < 10) ? gg : null,
    score: p.score ?? null,
    retake: p.retake ?? false,
    problems: p.problems.map((q, i) => {
      const unit = q.unit && allowed.has(q.unit) ? q.unit : null;
      const alt = q.unitAlt ?? q.unit_alt ?? null;
      return {
        n: i + 1,
        q: q.q,
        unit,
        answer: q.answer,
        mark: q.mark,
        confidence: q.confidence,
        unitConfidence: q.unitConfidence ?? q.unit_confidence ?? DEFAULT_UNIT_CONFIDENCE,
        unitAlt: alt && allowed.has(alt) && alt !== unit ? alt : null,
        correctAnswer: q.correctAnswer ?? q.correct_answer ?? null,
        judge: q.judge,
      };
    }),
    notes: p.notes ?? "",
  };
  return PageResultSchema.parse(result);
}
