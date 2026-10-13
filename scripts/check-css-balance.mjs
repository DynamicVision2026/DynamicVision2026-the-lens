// Every top-level CSS rule in the apps must close: a missing "}" silently nests every later rule
// (valid CSS nesting, so the build passes) and breaks styling far away. Hotfix after #75 (Architect, Oct 13).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (f === 'node_modules' || f === 'dist') continue; statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') && files.push(p); } };
walk('apps'); walk('packages');
let bad = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  let depth = 0, atDepth = [];
  src.split('\n').forEach((line, i) => {
    const t = line.trim();
    // a plain selector rule opening inside another plain rule = an unclosed block above it
    if (t.endsWith('{') && !t.startsWith('@') && depth > 0 && !atDepth[depth - 1] && !/^(from|to|\d+%)/.test(t)) {
      console.error(`${f}:${i + 1}: rule opens inside an unclosed rule: ${t}`); bad++;
    }
    for (const ch of line) {
      if (ch === '{') { atDepth[depth] = t.startsWith('@'); depth++; }
      else if (ch === '}') depth--;
    }
  });
  if (depth !== 0) { console.error(`${f}: ${depth} unclosed block(s) at end of file`); bad++; }
}
if (bad) process.exit(1);
console.log(`check-css-balance: ${files.length} CSS files balanced`);
