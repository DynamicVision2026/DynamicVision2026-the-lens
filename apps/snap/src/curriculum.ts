import raw from "../data/units.json";

/**
 * Unit id scheme (stable; never renumber):
 *   小学校  `${学年}-${領域}${番号}`      小5 C(3)      → "5-C3"
 *   中学校  `j${学年}-${領域}${番号}`     中2 A(1)      → "j2-A1"
 *   高校    `h-${科目}-${番号}`           数学I (3)     → "h-I-3", 数学A (2) → "h-A-2"
 * The id is derived only from (grade, unit code) in data/units.json, so it is stable
 * as long as those two fields do not change.
 */

export const GRADES = ["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "高1", "高2", "高3"] as const;
export type Grade = (typeof GRADES)[number];

/**
 * 高校: which school year studies which subject. The usual course order (学習指導要領 2022):
 *   高1 = 数学I + 数学A,  高2 = 数学II + 数学B,  高3 = 数学III + 数学C.
 * Schools vary (some start 数学II in the 3rd term of 高1, 文系 often skip III, C may come in 高2);
 * the reader's "own grade + the grade below" rule absorbs most of that (高2 also sees I/A,
 * 高3 also sees II/B, 高1 also sees 中3). Unit ids do not depend on this table (h-I-3 stays h-I-3).
 */
export const HIGH_SCHOOL_YEAR: Record<string, Grade> = {
  数学I: "高1",
  数学A: "高1",
  数学II: "高2",
  数学B: "高2",
  数学III: "高3",
  数学C: "高3",
};

export function isHighSchool(g: Grade): boolean {
  return g.startsWith("高");
}

/** Grade values saved before 19 Oct 2026 that are no longer grades: one combined 高校 → 高1. */
export const LEGACY_GRADES: Record<string, Grade> = { 高校: "高1" };

/** A saved grade value → today's grade (legacy 高校 → 高1); anything unknown passes through unchanged. */
export function migrateGradeValue(g: unknown): unknown {
  return typeof g === "string" && g in LEGACY_GRADES ? LEGACY_GRADES[g] : g;
}

/**
 * The grade saved in localStorage → Grade. `migrated`: it was a legacy value (高校 → 高1), so the
 * app should point the parent at the grade badge to check it.
 */
export function gradeFromPref(raw: string | null): { grade: Grade | null; migrated: boolean } {
  const grade = toGrade(raw);
  return { grade, migrated: grade !== null && raw !== grade };
}

/** A saved / sent grade value → Grade, or null when it is not one (legacy values are migrated). */
export function toGrade(g: unknown): Grade | null {
  const m = migrateGradeValue(g);
  return isGrade(m) ? m : null;
}

export interface RawUnit {
  level: string;
  grade: string;
  unit: string;
  topic: string;
  points: number;
  covers: string[];
}

export interface Unit extends RawUnit {
  id: string;
  /** App grade this unit belongs to (高校 subjects: their school year, see HIGH_SCHOOL_YEAR). */
  appGrade: Grade;
  /** Short label for chips, e.g. "C(3) 割合" or "数学I 二次関数". */
  label: string;
}

export function unitId(u: Pick<RawUnit, "level" | "grade" | "unit">): string {
  const code = u.unit.replace(/[()\s]/g, ""); // "C(3)" → "C3", "(3)" → "3"
  if (u.level === "小") return `${u.grade.replace("小", "")}-${code}`;
  if (u.level === "中") return `j${u.grade.replace("中", "")}-${code}`;
  if (u.level === "高") return `h-${u.grade.replace("数学", "")}-${code}`;
  throw new Error(`unknown level: ${u.level}`);
}

function appGradeOf(u: RawUnit): Grade {
  if (u.level === "高") {
    const g = HIGH_SCHOOL_YEAR[u.grade];
    if (!g) throw new Error(`no school year for ${u.grade}`);
    return g;
  }
  return u.grade as Grade;
}

export const UNITS: Unit[] = (raw as RawUnit[]).map((u) => ({
  ...u,
  id: unitId(u),
  appGrade: appGradeOf(u),
  label: u.level === "高" ? `${u.grade} ${u.topic}` : `${u.unit} ${u.topic}`,
}));

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));

/** grade → units map (used by the UI dropdown, the map screen and the reader prompt). */
export const UNITS_BY_GRADE: Record<Grade, Unit[]> = Object.fromEntries(
  GRADES.map((g) => [g, UNITS.filter((u) => u.appGrade === g)]),
) as Record<Grade, Unit[]>;

export function isGrade(g: unknown): g is Grade {
  return typeof g === "string" && (GRADES as readonly string[]).includes(g);
}

export function unitsForGrade(grade: Grade): Unit[] {
  return UNITS_BY_GRADE[grade];
}

export function unitById(id: string | null | undefined): Unit | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function previousGrade(grade: Grade): Grade | null {
  const i = GRADES.indexOf(grade);
  return i > 0 ? GRADES[i - 1] : null;
}

/**
 * Units the reader may assign for a page of this grade: the grade's own units plus the
 * previous grade's (review pages and 復習ノート mix in last year's units, e.g. a 小6 note
 * with 5-C2 速さ; 高2 also sees 数学I/A, 高1 also sees 中3). Anything else becomes null and the user picks.
 */
export function readerUnitsForGrade(grade: Grade): Unit[] {
  const prev = previousGrade(grade);
  return [...unitsForGrade(grade), ...(prev ? unitsForGrade(prev) : [])];
}
