import { describe, expect, it } from "vitest";
import {
  type Layers,
  type NavStep,
  NO_LAYERS,
  arrivalStep,
  cameraStep,
  closeTop,
  layersOf,
  openSheet,
  openViewer,
  openYears,
  sheetShown,
} from "../src/lib/layers";

/** A browser history in miniature: entries on one tab, the map's own entry after a previous screen. */
class FakeHistory {
  entries: { path: string; state: unknown }[] = [
    { path: "/app/report", state: null },
    { path: "/app/map", state: null },
  ];
  i = 1;
  get path() {
    return this.entries[this.i].path;
  }
  get layers(): Layers {
    return layersOf(this.entries[this.i].state);
  }
  /** What the map does with a step (navigate(-1) / navigate(sameUrl, { state, replace })). */
  apply(step: NavStep | null) {
    if (!step) return;
    if (step.kind === "back") return this.back();
    const e = { path: this.path, state: step.state };
    if (step.kind === "replace") this.entries[this.i] = e;
    else {
      this.entries = [...this.entries.slice(0, this.i + 1), e];
      this.i++;
    }
  }
  /** The browser's back button / iPhone swipe-back. */
  back() {
    this.i = Math.max(0, this.i - 1);
  }
}

describe("back-navigation order over the map", () => {
  it("back closes the viewer, then the sheet, and only then leaves the map", () => {
    const h = new FakeHistory();
    h.apply(openSheet(h.layers, "5-C3"));
    h.apply(openViewer(h.layers, "page-1"));
    expect(h.layers).toMatchObject({ sheet: "5-C3", viewer: "page-1" });
    h.back();
    expect(h.layers).toMatchObject({ sheet: "5-C3", viewer: null });
    expect(h.path).toBe("/app/map");
    h.back();
    expect(h.layers).toEqual(NO_LAYERS);
    expect(h.path).toBe("/app/map");
    h.back();
    expect(h.path).toBe("/app/report"); // nothing open: the browser's own back
  });

  it("✕ / Esc / a tap on the map take the same way back (no extra entries left behind)", () => {
    const h = new FakeHistory();
    h.apply(openSheet(h.layers, "5-C3"));
    h.apply(openViewer(h.layers, "page-1"));
    h.apply(closeTop(h.layers));
    expect(h.layers).toMatchObject({ sheet: "5-C3", viewer: null });
    h.apply(closeTop(h.layers));
    expect(h.layers).toEqual(NO_LAYERS);
    expect(h.i).toBe(1);
    expect(closeTop(h.layers)).toBeNull(); // nothing open: never leaves the map
  });

  it("switching units in the open sheet (a root, 次へ, another tile) replaces the entry: one back closes it", () => {
    const h = new FakeHistory();
    h.apply(openSheet(h.layers, "5-C3"));
    h.apply(openSheet(h.layers, "4-C2"));
    h.apply(openSheet(h.layers, "5-C1"));
    expect(h.layers.sheet).toBe("5-C1");
    expect(h.entries).toHaveLength(3);
    h.back();
    expect(h.layers).toEqual(NO_LAYERS);
    expect(h.path).toBe("/app/map");
  });

  it("年度の記録 is a layer too, and a tile tapped under it replaces it", () => {
    const h = new FakeHistory();
    h.apply(openYears(h.layers));
    expect(h.layers.years).toBe(true);
    h.apply(openSheet(h.layers, "5-C3"));
    expect(h.layers).toMatchObject({ sheet: "5-C3", years: false });
    h.back();
    expect(h.layers).toEqual(NO_LAYERS);
  });

  it("?unit= on arrival: the sheet is its own entry, so back closes it before going back to the report", () => {
    const h = new FakeHistory();
    h.apply(arrivalStep(h.layers, "3-A4"));
    expect(h.layers.sheet).toBe("3-A4");
    h.back();
    expect(h.layers).toEqual(NO_LAYERS);
    expect(h.path).toBe("/app/map");
    h.back();
    expect(h.path).toBe("/app/report");
    expect(arrivalStep(NO_LAYERS, null)).toBeNull();
    expect(arrivalStep({ ...NO_LAYERS, sheet: "3-A4", d: 1 }, "3-A4")).toBeNull(); // reload: already open
  });

  it("a layer without an entry of ours (d = 0) is closed in place, never by leaving", () => {
    expect(closeTop({ ...NO_LAYERS, sheet: "5-C3", d: 0 })).toEqual({ kind: "replace", state: { snap: NO_LAYERS } });
    expect(closeTop({ ...NO_LAYERS, sheet: "5-C3", viewer: "p", d: 0 })).toEqual({
      kind: "replace",
      state: { snap: { ...NO_LAYERS, sheet: "5-C3", d: 0 } },
    });
  });

  it("history state from elsewhere reads as no layers; a viewer needs its sheet", () => {
    expect(layersOf(null)).toEqual(NO_LAYERS);
    expect(layersOf({ usr: 1 })).toEqual(NO_LAYERS);
    expect(layersOf({ snap: { viewer: "p", d: 2 } })).toMatchObject({ sheet: null, viewer: null, d: 2 });
    expect(layersOf({ snap: { sheet: "5-C3", years: true, d: -3 } })).toMatchObject({ sheet: "5-C3", years: false, d: 0 });
  });
});

describe("map camera with the sheet and the page viewer", () => {
  /** The camera actions along a run of layers (as TerritoryMap sees them: is the unit sheet shown?). */
  const run = (seq: Layers[], movedAt = -1) =>
    seq.slice(1).map((l, i) => cameraStep(sheetShown(seq[i]), sheetShown(l), i === movedAt));
  const sheet = { ...NO_LAYERS, sheet: "5-C3", d: 1 };
  const viewer = { ...sheet, viewer: "page-1", d: 2 };
  const other = { ...NO_LAYERS, sheet: "4-C2", d: 1 };

  it("opening the sheet remembers the view; the viewer over it never moves the camera; closing flies back", () => {
    expect(run([NO_LAYERS, sheet, viewer, sheet, NO_LAYERS])).toEqual(["save", "keep", "keep", "restore"]);
  });

  it("switching units keeps the remembered view; a map moved by hand is not pulled back", () => {
    expect(run([NO_LAYERS, sheet, other, NO_LAYERS])).toEqual(["save", "keep", "restore"]);
    expect(cameraStep(true, false, true)).toBe("keep");
    expect(cameraStep(false, false, false)).toBe("keep");
  });
});

describe("テスト前 tab entry", () => {
  it("opens the plan (date when no test) with d = 0, so closing replaces and the map shows", async () => {
    const { EXAM_ENTRY, layersOf, closeTop } = await import("../src/lib/layers");
    const l = layersOf(EXAM_ENTRY);
    expect(l.exam).toBe("plan");
    expect(l.d).toBe(0);
    expect(closeTop(l)).toEqual({ kind: "replace", state: { snap: expect.objectContaining({ exam: null }) } });
  });
});
