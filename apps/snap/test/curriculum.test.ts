import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADES, UNITS, readerUnitsForGrade, unitById, unitId, unitsForGrade } from "../src/curriculum";

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

  it("every unit belongs to exactly one grade", () => {
    const total = GRADES.reduce((n, g) => n + unitsForGrade(g).length, 0);
    expect(total).toBe(110);
    expect(unitsForGrade("小5").every((u) => u.id.startsWith("5-"))).toBe(true);
    expect(unitsForGrade("高校").every((u) => u.id.startsWith("h-"))).toBe(true);
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
