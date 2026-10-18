/**
 * pnpm eval [--reader mock|claude]
 * Runs the reader over fixtures/photos/*.jpg and scores against fixtures/truth.json.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isGrade } from "../src/curriculum";
import { type PageScore, type TruthPage, formatTable, scorePage } from "../src/lib/score";
import { type ReaderKind, createReader } from "../src/reader";

const argv = process.argv.slice(2);
const i = argv.indexOf("--reader");
const kind = (i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith("--reader="))?.split("=")[1]) as ReaderKind | undefined;
if (kind && kind !== "mock" && kind !== "claude") {
  console.error("usage: pnpm eval [--reader mock|claude]");
  process.exit(2);
}
const reader = createReader(kind ?? "mock");
const dir = join(process.cwd(), "fixtures");
const truth: Record<string, TruthPage> = JSON.parse(readFileSync(join(dir, "truth.json"), "utf8"));
const photos = readdirSync(join(dir, "photos")).filter((f) => /\.jpe?g$/i.test(f)).sort((a, b) => {
  // p01..p10 first, then h01..h06
  const ka = (a.startsWith("p") ? "0" : "1") + a, kb = (b.startsWith("p") ? "0" : "1") + b;
  return ka.localeCompare(kb);
});

const rows: PageScore[] = [];
for (const f of photos) {
  const id = f.replace(/\.\w+$/, "");
  const t = truth[id];
  if (!t) continue;
  if (!isGrade(t.grade)) throw new Error(`bad grade in truth for ${id}`);
  const page = await reader.read(new Uint8Array(readFileSync(join(dir, "photos", f))), "image/jpeg", t.grade);
  rows.push(scorePage(id, t, page));
}
console.log(formatTable(rows, reader.name));
