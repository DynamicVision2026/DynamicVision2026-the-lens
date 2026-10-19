import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftFromResult, pageFromDraft } from "../src/lib/model";
import { mapSections, mapTiles, readiness, testList } from "../src/lib/review";
import { allPages, deletePage, savePage, setReviewed } from "../src/lib/store";
import { MockReader } from "../src/reader/mock";

const photo = (id: string) => new Uint8Array(readFileSync(new URL(`../fixtures/photos/${id}.jpg`, import.meta.url)));

describe("mock reader → confirm → save → テスト前リスト", () => {
  const reader = new MockReader();

  it("matches fixture photos by content", () => {
    expect(reader.idFor(photo("p01"))).toBe("p01");
    expect(reader.idFor(photo("h04"))).toBe("h04");
    expect(reader.idFor(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("flags the unreadable photo for retake", async () => {
    const r = await reader.read(photo("h03"), "image/jpeg", "小6");
    expect(r.retake).toBe(true);
    expect(r.problems).toHaveLength(0);
  });

  it("lists exactly the ✕ problems of the chosen units", async () => {
    // p01: 小5 割合 test, ✕ on problems 3 and 4. p02: 小5 小数 test, ✕ on 2 and 6.
    for (const [id, grade] of [["p01", "小5"], ["p02", "小5"], ["p03", "小6"]] as const) {
      const result = await reader.read(photo(id), "image/jpeg", grade);
      const draft = draftFromResult(result); // confirm screen: user accepts as read
      await savePage(pageFromDraft(draft, { grade, pageType: result.pageType, score: result.score }));
    }
    const pages = await allPages();
    expect(pages).toHaveLength(3);

    const list = testList(pages, ["5-C3"]);
    expect(list.map((i) => i.problem.n)).toEqual([3, 4]);
    expect(list.every((i) => i.problem.mark === "✕" && i.problem.unit === "5-C3")).toBe(true);
    expect(list.map((i) => i.problem.q)).toEqual([
      "水そうに水が120L入ります。いま、その0.35倍の水が入っています。水は何L入っていますか。",
      "ある数の40%が56です。ある数はいくつですか。",
    ]);

    expect(testList(pages, ["5-C3", "5-A3"])).toHaveLength(4);
    expect(testList(pages, ["6-A1"])).toHaveLength(0); // drill without marks, confident reads
    expect(testList(pages, [])).toHaveLength(0);

    // マップ: 割合 tile needs review.
    const tile = mapTiles(pages).find((t) => t.unit.id === "5-C3")!;
    expect(tile).toMatchObject({ count: 5, wrong: 2, key: "trying" });
    // A unit from another grade shows up in its own grade section.
    const sec6 = mapSections(pages, "小5").find((s) => s.grade === "小6")!;
    expect(sec6.tiles.find((t) => t.unit.id === "6-A1")!.level).toBeGreaterThan(0);

    // Readiness: 3 of 5 ok → 60%; after reviewing both ✕ → 100% and the tile turns ok.
    expect(readiness(pages, ["5-C3"])).toBe(60);
    const p01 = list[0].page;
    await setReviewed(p01.id, list[0].index, true);
    await setReviewed(p01.id, list[1].index, true);
    const after = await allPages();
    expect(readiness(after, ["5-C3"])).toBe(100);
    expect(mapTiles(after).find((t) => t.unit.id === "5-C3")!.key).toBe("reviewed");
    expect(testList(after, ["5-C3"]).every((i) => i.problem.reviewed)).toBe(true);

    await deletePage(p01.id);
    expect(testList(await allPages(), ["5-C3"])).toHaveLength(0);
  });

  it("includes low-confidence reads and respects user edits on the confirm screen", async () => {
    const result = await reader.read(photo("p01"), "image/jpeg", "小5");
    const draft = draftFromResult(result);
    draft[0] = { ...draft[0], mark: null, confidence: 0.3 }; // uncertain, unmarked
    draft[1] = { ...draft[1], unit: "5-B3", edited: true }; // user re-filed it
    const page = pageFromDraft(draft, { grade: "小5", pageType: result.pageType, score: result.score });
    const list = testList([page], ["5-C3"]);
    expect(list.map((i) => [i.problem.n, i.reason])).toEqual([[1, "low"], [3, "wrong"], [4, "wrong"]]);
    expect(page.problems[1]).toMatchObject({ unit: "5-B3", confidence: 1 });
  });
});
