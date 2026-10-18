import raw from "../data/units.json";

/**
 * Unit id scheme (stable; never renumber):
 *   小学校  `${学年}-${領域}${番号}`      小5 C(3)      → "5-C3"
 *   中学校  `j${学年}-${領域}${番号}`     中2 A(1)      → "j2-A1"
 *   高校    `h-${科目}-${番号}`           数学I (3)     → "h-I-3", 数学A (2) → "h-A-2"
 * The id is derived only from (grade, unit code) in data/units.json, so it is stable
 * as long as those two fields do not change.
 */

export const GRADES = ["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "高校"] as const;
export type Grade = (typeof GRADES)[number];

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
  /** App grade this unit belongs to (高校 subjects collapse to "高校"). */
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
  return (u.level === "高" ? "高校" : u.grade) as Grade;
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
 * with 5-C2 速さ). Anything else becomes null and the user picks.
 */
export function readerUnitsForGrade(grade: Grade): Unit[] {
  const prev = previousGrade(grade);
  return [...unitsForGrade(grade), ...(prev ? unitsForGrade(prev) : [])];
}
