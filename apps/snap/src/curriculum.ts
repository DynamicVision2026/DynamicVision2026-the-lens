import raw from "../data/units.json";
import i18nRaw from "../data/units.i18n.json";
import { LANG } from "./lib/lang";

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
  /** The Japanese topic / covers (unit logic — roots, the reader — always uses these; topic/covers are for display). */
  topicJa: string;
  coversJa: string[];
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

type UnitText = { topic: string; covers: string[] };
const I18N = i18nRaw as ({ topic_ja: string } & Record<"en" | "zh-Hans" | "zh-Hant", UnitText>)[];

/** Display names for grades and 高校 subjects in other languages (saved values stay 小5 …, 数学I …). */
const GRADE_NAMES: Record<"en" | "zh-Hans" | "zh-Hant", Record<string, string>> = {
  en: {
    小1: "Grade 1", 小2: "Grade 2", 小3: "Grade 3", 小4: "Grade 4", 小5: "Grade 5", 小6: "Grade 6",
    中1: "Grade 7", 中2: "Grade 8", 中3: "Grade 9", 高1: "Grade 10", 高2: "Grade 11", 高3: "Grade 12",
    数学I: "Math I", 数学II: "Math II", 数学III: "Math III", 数学A: "Math A", 数学B: "Math B", 数学C: "Math C",
  },
  "zh-Hans": {
    小1: "一年级", 小2: "二年级", 小3: "三年级", 小4: "四年级", 小5: "五年级", 小6: "六年级",
    中1: "初一", 中2: "初二", 中3: "初三", 高1: "高一", 高2: "高二", 高3: "高三",
    数学I: "数学I", 数学II: "数学II", 数学III: "数学III", 数学A: "数学A", 数学B: "数学B", 数学C: "数学C",
  },
  "zh-Hant": {
    小1: "一年級", 小2: "二年級", 小3: "三年級", 小4: "四年級", 小5: "五年級", 小6: "六年級",
    中1: "國一", 中2: "國二", 中3: "國三", 高1: "高一", 高2: "高二", 高3: "高三",
    数学I: "數學I", 数学II: "數學II", 数学III: "數學III", 数学A: "數學A", 数学B: "數學B", 数学C: "數學C",
  },
};

/** A grade (小5) or 高校 subject (数学I) as shown in the display language; anything else unchanged. */
export function gradeLabel(g: string): string {
  return LANG === "ja" ? g : (GRADE_NAMES[LANG][g] ?? g);
}

export const UNITS: Unit[] = (raw as RawUnit[]).map((u, i) => {
  const tr = LANG === "ja" ? null : I18N[i]?.topic_ja === u.topic ? I18N[i][LANG] : null;
  const topic = tr?.topic ?? u.topic;
  return {
    ...u,
    topic,
    covers: tr?.covers ?? u.covers,
    topicJa: u.topic,
    coversJa: u.covers,
    id: unitId(u),
    appGrade: appGradeOf(u),
    label: u.level === "高" ? `${gradeLabel(u.grade)} ${topic}` : `${u.unit} ${topic}`,
  };
});

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
