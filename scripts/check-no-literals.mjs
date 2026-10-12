// Fails when a hex colour literal appears in scene or app source. Colours come from tokens/tokens.json.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findRepoRoot } from './check-bundle.mjs';

const root = findRepoRoot();
const HEX = /#[0-9a-f]{3,8}\b/gi;
const EXTENSIONS = /\.(tsx?|jsx?|mjs|css|html)$/;

function sourceDirs() {
  const dirs = [join(root, 'packages/scenes/src')];
  for (const app of readdirSync(join(root, 'apps'))) {
    dirs.push(join(root, 'apps', app, 'src'));
  }
  return dirs.filter((d) => {
    try {
      return statSync(d).isDirectory();
    } catch {
      return false;
    }
  });
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (EXTENSIONS.test(entry.name)) yield path;
  }
}

const hits = [];
for (const dir of sourceDirs()) {
  for (const file of files(dir)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(HEX)) hits.push(`${relative(root, file)}:${i + 1}  ${m[0]}`);
      });
  }
}

if (hits.length > 0) {
  console.error('Hex colour literals found (use tokens/tokens.json instead):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('check-no-literals: no hex colour literals in packages/scenes/src or apps/*/src');
