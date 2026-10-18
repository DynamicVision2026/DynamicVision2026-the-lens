#!/usr/bin/env node
// Waitlist → CSV. Works with either storage format:
//   node scripts/waitlist-export.mjs <WAITLIST_DIR>     (one JSON file per signup; subfolders too)
//   node scripts/waitlist-export.mjs <waitlist.jsonl>   (one JSON object per line)
// Output (stdout): email,grade,worry,variant,src,at — sorted by `at`. Rows without src → "direct".
// Contains personal data: keep the CSV out of git (data-private/ is ignored).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const COLS = ["email", "grade", "worry", "variant", "src", "at"];

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".json") || e.name.endsWith(".jsonl")) yield p;
  }
}

function parseLines(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      process.stderr.write("skipped a malformed line\n");
    }
  }
  return out;
}

const cell = (v) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const target = process.argv[2];
if (!target) {
  process.stderr.write("usage: node scripts/waitlist-export.mjs <dir-or-jsonl> > waitlist.csv\n");
  process.exit(2);
}
const files = statSync(target).isDirectory() ? [...walk(target)] : [target];
const rows = files.flatMap((f) => parseLines(readFileSync(f, "utf8")));
rows.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
process.stdout.write(COLS.join(",") + "\n");
for (const r of rows) process.stdout.write(COLS.map((c) => cell(c === "src" ? (r.src ?? "direct") : r[c])).join(",") + "\n");
