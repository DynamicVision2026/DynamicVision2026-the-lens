import { z } from "zod";
import { type Grade, isGrade, readerUnitsForGrade } from "../curriculum";

export const MARKS = ["○", "✕"] as const;
export type Mark = (typeof MARKS)[number] | null;

/** Normalise the many ways a model may write a mark. */
function normMark(v: unknown): Mark {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (["○", "〇", "◯", "o", "O", "correct"].includes(s)) return "○";
  if (["✕", "×", "✗", "✖", "x", "X", "wrong"].includes(s)) return "✕";
  return null;
}

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

/** Lenient input shape: accepts the model's snake_case JSON or our camelCase. */
const RawProblem = z.object({
  n: z.coerce.number().int().positive().optional(),
  q: z.string().default(""),
  unit: nullableString,
  answer: nullableString,
  mark: z.unknown().transform(normMark),
  confidence: z.coerce.number().min(0).max(1).catch(0.5).default(0.5),
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
    problems: p.problems.map((q, i) => ({
      n: i + 1,
      q: q.q,
      unit: q.unit && allowed.has(q.unit) ? q.unit : null,
      answer: q.answer,
      mark: q.mark,
      confidence: q.confidence,
    })),
    notes: p.notes ?? "",
  };
  return PageResultSchema.parse(result);
}
