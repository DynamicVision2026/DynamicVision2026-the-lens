#!/usr/bin/env node
// 1-year pass codes to hand out (course buyers outside Shopify, gifts, pilot families).
//   node apps/snap/scripts/make-codes.mjs <count> <out-dir> [note]
// Writes one file per code into <out-dir>/lic/ (same format as the server's plan store) and prints the
// codes. A code's year starts when it is first entered; up to 3 family devices can share it.
// apps/snap/make-codes.sh uploads the files to the live plan store and keeps a CSV.
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // same as server/plans.ts
const [count = "10", out = "./codes", note = ""] = process.argv.slice(2);
const n = Math.max(1, Math.min(1000, Number.parseInt(count, 10) || 0));
mkdirSync(join(out, "lic"), { recursive: true });
const now = new Date().toISOString();
const codes = [];
for (let i = 0; i < n; i++) {
  const c = [...randomBytes(12)].map((x) => ALPHA[x % ALPHA.length]).join("");
  const key = `LS-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
  writeFileSync(join(out, "lic", `LS${c}.json`), JSON.stringify({ key, kind: "code", expiresAt: null, devices: [], createdAt: now, note: note || undefined }));
  codes.push(key);
}
console.log(codes.join("\n"));
