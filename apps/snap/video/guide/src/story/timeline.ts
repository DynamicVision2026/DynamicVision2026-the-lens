import durations from "./durations.json";
import story from "./story.json";

export const FPS = 30;
const D = durations as Record<string, number>;
const TEXT: Record<string, { text: string; v: string }> = Object.fromEntries(
  (story.lines as { id: string; text: string; v: string }[]).map((l) => [l.id, { text: l.text, v: l.v }]),
);

export type Line = { id: string; text: string; v: string; from: number; dur: number };

/** Lay voice lines end to end: `lead` seconds first, `gap` between lines, plus `extra[id]` seconds after a line. */
export function lay(ids: string[], lead: number, gap: number, extra: Record<string, number>, tail: number) {
  const lines: Line[] = [];
  let t = lead;
  for (const id of ids) {
    lines.push({ id, text: TEXT[id].text, v: TEXT[id].v, from: Math.round(t * FPS), dur: Math.round(D[id] * FPS) });
    t += D[id] + gap + (extra[id] ?? 0);
  }
  const get = (id: string) => lines.find((l) => l.id === id) as Line;
  const at = (id: string) => get(id).from;
  const end = (id: string) => get(id).from + get(id).dur;
  const total = end(ids[ids.length - 1]) + Math.round(tail * FPS);
  return { lines, at, end, total };
}

export const CREDITS = "VOICEVOX:No.7 ・ VOICEVOX:もち子(cv 明日葉よもぎ) ・ VOICEVOX:白上虎太郎";
