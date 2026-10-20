import durations from "./durations.json";
import narration from "../../narration.json";

export const FPS = 30;
const LEAD = 2.5; // before the first line
const LINE_GAP = 0.8; // between lines in a scene
const SCENE_GAP = 2.0; // breathing room between scenes
const TAIL = 5.5; // after the last line (logo)

export type SceneId = "hook" | "title" | "map" | "snap" | "ladder" | "roots" | "exam" | "devices" | "plans";
export const SCENES: { id: SceneId; lines: string[] }[] = [
  { id: "hook", lines: ["s01", "s02"] },
  { id: "title", lines: ["s03"] },
  { id: "map", lines: ["s04", "s05", "s06"] },
  { id: "snap", lines: ["s07", "s08", "s09", "s10"] },
  { id: "ladder", lines: ["s11", "s12", "s13"] },
  { id: "roots", lines: ["s14", "s15"] },
  { id: "exam", lines: ["s16", "s17", "s18", "s19"] },
  { id: "devices", lines: ["s20"] },
  { id: "plans", lines: ["s21", "s22"] },
];

export interface Line {
  id: string;
  text: string;
  from: number; // frame
  dur: number; // frames
}
export interface Scene {
  id: SceneId;
  from: number;
  dur: number;
  lines: Line[];
}

const text = Object.fromEntries((narration.lines as { id: string; text: string }[]).map((l) => [l.id, l.text]));
const f = (s: number) => Math.round(s * FPS);

function build() {
  let t = LEAD;
  const scenes: Scene[] = [];
  SCENES.forEach((sc, i) => {
    const start = i === 0 ? 0 : t - SCENE_GAP / 2;
    const lines: Line[] = [];
    sc.lines.forEach((id, j) => {
      const d = (durations as Record<string, number>)[id];
      lines.push({ id, text: text[id], from: f(t), dur: f(d) });
      t += d + (j < sc.lines.length - 1 ? LINE_GAP : 0);
    });
    const end = i === SCENES.length - 1 ? t + TAIL : t + SCENE_GAP / 2;
    scenes.push({ id: sc.id, from: f(start), dur: f(end) - f(start), lines });
    t += SCENE_GAP;
  });
  const last = scenes[scenes.length - 1];
  return { scenes, total: last.from + last.dur };
}

export const TIMELINE = build();
export const sceneOf = (id: SceneId) => TIMELINE.scenes.find((s) => s.id === id) as Scene;
