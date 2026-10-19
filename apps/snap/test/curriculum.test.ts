import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADES, HIGH_SCHOOL_YEAR, UNITS, gradeFromPref, readerUnitsForGrade, toGrade, unitById, unitId, unitsForGrade } from "../src/curriculum";

describe("curriculum ids", () => {
  it("has 110 units with unique ids", () => {
    expect(UNITS).toHaveLength(110);
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(110);
  });

  it("ids are stable (match the committed list exactly, in order)", () => {
    const expected = JSON.parse(readFileSync(new URL("./unit-ids.json", import.meta.url), "utf8"));
    expect(UNITS.map((u) => u.id)).toEqual(expected);
  });

  it("follows the documented scheme", () => {
    expect(unitId({ level: "小", grade: "小5", unit: "C(3)" })).toBe("5-C3");
    expect(unitId({ level: "中", grade: "中2", unit: "A(1)" })).toBe("j2-A1");
    expect(unitId({ level: "高", grade: "数学I", unit: "(3)" })).toBe("h-I-3");
    expect(unitId({ level: "高", grade: "数学A", unit: "(2)" })).toBe("h-A-2");
    expect(unitById("5-C3")?.topic).toBe("割合");
  });

  it("12 grades: 小1…小6, 中1…中3, 高1 / 高2 / 高3 (never one combined 高校)", () => {
    expect(GRADES).toEqual(["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "高1", "高2", "高3"]);
    expect(GRADES).toHaveLength(12);
    expect(GRADES as readonly string[]).not.toContain("高校");
  });

  it("every one of the 110 units belongs to exactly one grade", () => {
    const total = GRADES.reduce((n, g) => n + unitsForGrade(g).length, 0);
    expect(total).toBe(110);
    for (const u of UNITS) expect(GRADES.filter((g) => unitsForGrade(g).includes(u)), u.id).toEqual([u.appGrade]);
    for (const g of GRADES) expect(unitsForGrade(g).length, g).toBeGreaterThan(0);
    expect(unitsForGrade("小5").every((u) => u.id.startsWith("5-"))).toBe(true);
  });

  it("高校 units by school year: 高1 = I + A, 高2 = II + B, 高3 = III + C (ids unchanged)", () => {
    const subj = (g: (typeof GRADES)[number]) => [...new Set(unitsForGrade(g).map((u) => u.grade))].sort();
    expect(subj("高1")).toEqual(["数学A", "数学I"]);
    expect(subj("高2")).toEqual(["数学B", "数学II"]);
    expect(subj("高3")).toEqual(["数学C", "数学III"]);
    expect(unitsForGrade("高1").map((u) => u.id)).toEqual(["h-I-1", "h-I-2", "h-I-3", "h-I-4", "h-A-1", "h-A-2", "h-A-3"]);
    expect(unitsForGrade("高2")).toHaveLength(8);
    expect(unitsForGrade("高3")).toHaveLength(6);
    expect(Object.keys(HIGH_SCHOOL_YEAR).sort()).toEqual([...new Set(UNITS.filter((u) => u.level === "高").map((u) => u.grade))].sort());
    expect(unitById("h-I-3")?.appGrade).toBe("高1");
  });

  it("high-school reader lists: own year + the year below (高1 → 中3)", () => {
    const subjects = (g: (typeof GRADES)[number]) => readerUnitsForGrade(g).map((u) => (u.level === "高" ? u.grade : u.appGrade));
    expect(new Set(subjects("高2"))).toEqual(new Set(["数学II", "数学B", "数学I", "数学A"]));
    expect(readerUnitsForGrade("高2")).toHaveLength(8 + 7);
    expect(new Set(subjects("高1"))).toEqual(new Set(["数学I", "数学A", "中3"]));
    expect(readerUnitsForGrade("高1").map((u) => u.id)).toContain("j3-C1");
    expect(new Set(subjects("高3"))).toEqual(new Set(["数学III", "数学C", "数学II", "数学B"]));
    expect(readerUnitsForGrade("高3").some((u) => u.grade === "数学I")).toBe(false);
  });

  it("legacy grade 「高校」 → 高1 (saved prefs, pages, requests); unknown values stay unknown", () => {
    expect(toGrade("高校")).toBe("高1");
    expect(toGrade("高2")).toBe("高2");
    expect(toGrade("小7")).toBeNull();
    expect(toGrade(null)).toBeNull();
    expect(gradeFromPref("高校")).toEqual({ grade: "高1", migrated: true });
    expect(gradeFromPref("中2")).toEqual({ grade: "中2", migrated: false });
    expect(gradeFromPref(null)).toEqual({ grade: null, migrated: false });
  });

  it("reader list = grade + previous grade", () => {
    const ids = readerUnitsForGrade("小6").map((u) => u.id);
    expect(ids).toContain("6-A1");
    expect(ids).toContain("5-C2");
    expect(ids).not.toContain("4-A1");
    expect(readerUnitsForGrade("小1").map((u) => u.id).every((id) => id.startsWith("1-"))).toBe(true);
  });

  it("all fixture truth units exist", () => {
    const truth = JSON.parse(readFileSync(new URL("../fixtures/truth.json", import.meta.url), "utf8"));
    for (const page of Object.values<any>(truth)) for (const p of page.problems) expect(unitById(p.unit), p.unit).toBeTruthy();
  });
});
