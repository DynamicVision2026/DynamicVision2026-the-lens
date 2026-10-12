// Fails fast with a clear message when build/bundle.json has not been generated.
// Used by the trainer's vite.config.ts, the shorts' remotion.config.ts and `pnpm typecheck`.
// No import.meta here: Remotion bundles its config as CommonJS.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Walks up from `from` to the workspace root (the folder holding pnpm-workspace.yaml). */
export function findRepoRoot(from = process.cwd()) {
  let dir = from;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No pnpm-workspace.yaml above ${from}`);
    dir = parent;
  }
  return dir;
}

export function assertBundle(from) {
  if (!existsSync(join(findRepoRoot(from), 'build', 'bundle.json'))) {
    throw new Error('build/bundle.json not found. Run `pnpm bundle` first.');
  }
}

if (process.argv[1]?.endsWith('check-bundle.mjs')) {
  try {
    assertBundle();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
