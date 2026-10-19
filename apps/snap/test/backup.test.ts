import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { BackupError, backupFileName, makeBackup, needsBackupReminder, newPages, parseBackup } from "../src/lib/backup";
import type { SavedPage } from "../src/lib/model";
import { _resetDbHandle, allPages, importPages, savePage } from "../src/lib/store";

const jpeg = readFileSync(new URL("../fixtures/photos/p01.jpg", import.meta.url));
const photoBytes = () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer;

function page(id: string, at: string, withPhoto = false): SavedPage {
  return {
    id,
    createdAt: at,
    grade: "小5",
    pageType: "test",
    score: "80",
    ...(withPhoto ? { photo: { bytes: photoBytes(), mime: "image/jpeg" } } : {}),
    problems: [
      { n: 1, q: "ある数の40%が56です。", unit: "5-C3", answer: "140", mark: "✕", confidence: 0.92, reviewed: true },
      { n: 2, q: "0.35倍", unit: null, answer: null, mark: null, confidence: 0.4, reviewed: false },
    ],
  };
}

async function clearDb() {
  await _resetDbHandle();
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase("lens-snap");
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

describe("backup / restore", () => {
  beforeEach(clearDb);

  it("round-trips export → JSON → import with photos intact", async () => {
    const a = page("a", "2026-10-01T09:00:00.000Z", true);
    const b = page("b", "2026-10-02T09:00:00.000Z");
    await savePage(a);
    await savePage(b);
    const text = JSON.stringify(makeBackup(await allPages(), "小5", new Date("2026-10-19T12:00:00Z")));
    const file = JSON.parse(text);
    expect(file).toMatchObject({ app: "lens-snap", version: 1, exportedAt: "2026-10-19T12:00:00.000Z", grade: "小5" });
    expect(file.pages).toHaveLength(2);

    await clearDb(); // a new phone
    expect(await importPages(parseBackup(text))).toBe(2);
    const back = await allPages();
    expect(back.map((p) => p.id)).toEqual(["b", "a"]);
    const ra = back.find((p) => p.id === "a")!;
    // Pages saved before markSource existed come back with it filled in (mark set → teacher).
    expect(ra.problems).toEqual(a.problems.map((p) => ({ ...p, markSource: p.mark ? "teacher" : null })));
    expect(ra.score).toBe("80");
    expect(ra.photo!.mime).toBe("image/jpeg");
    expect(Buffer.from(ra.photo!.bytes).equals(jpeg)).toBe(true);
    expect(back.find((p) => p.id === "b")!.photo).toBeUndefined();
  });

  it("merges by page id: existing pages kept, only new ones added, no duplicates", async () => {
    const kept = page("a", "2026-10-01T09:00:00.000Z");
    kept.problems[0].reviewed = false; // changed on this device after the backup
    await savePage(kept);
    const backup = JSON.stringify(makeBackup([page("a", "2026-10-01T09:00:00.000Z"), page("c", "2026-10-03T09:00:00.000Z")], null));

    expect(await importPages(parseBackup(backup))).toBe(1);
    expect(await importPages(parseBackup(backup))).toBe(0); // restoring twice adds nothing
    const all = await allPages();
    expect(all.map((p) => p.id).sort()).toEqual(["a", "c"]);
    expect(all.find((p) => p.id === "a")!.problems[0].reviewed).toBe(false); // this device's copy wins

    const dup = page("d", "2026-10-04T09:00:00.000Z");
    expect(newPages(["a"], [dup, dup, page("a", "2026-10-01T09:00:00.000Z")]).map((p) => p.id)).toEqual(["d"]);
  });

  it("rejects files that are not a Lens Snap backup", () => {
    const good = makeBackup([page("a", "2026-10-01T09:00:00.000Z", true)], "小5");
    const bad = [
      "not json at all",
      "{}",
      JSON.stringify({ ...good, app: "other-app" }),
      JSON.stringify({ ...good, version: 99 }),
      JSON.stringify({ ...good, pages: [{ ...good.pages[0], grade: "大学" }] }),
      JSON.stringify({ ...good, pages: [{ ...good.pages[0], problems: [{ n: 1 }] }] }),
      JSON.stringify({ ...good, pages: [{ ...good.pages[0], photo: { mime: "text/html", base64: "AAAA" } }] }),
      JSON.stringify({ ...good, pages: [{ ...good.pages[0], photo: { mime: "image/jpeg", base64: "<script>" } }] }),
    ];
    for (const t of bad) expect(() => parseBackup(t), t.slice(0, 40)).toThrow(BackupError);
    expect(parseBackup(JSON.stringify(good))).toHaveLength(1);
  });

  it("file name and reminder rule", () => {
    expect(backupFileName(new Date(2026, 9, 9, 23, 0))).toBe("lens-snap-backup-20261009.json");
    const now = new Date("2026-10-19T12:00:00Z");
    expect(needsBackupReminder(0, null, now)).toBe(false);
    expect(needsBackupReminder(1, null, now)).toBe(true);
    expect(needsBackupReminder(3, "2026-10-10T12:00:00Z", now)).toBe(false);
    expect(needsBackupReminder(3, "2026-10-04T11:00:00Z", now)).toBe(true); // > 14 days
  });
});
