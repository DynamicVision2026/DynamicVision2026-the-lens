// pnpm render:short <cardId>  →  out/<cardId>.mp4 (repo root, git-ignored)
// Set REMOTION_BROWSER_EXECUTABLE to use an installed Chromium instead of Remotion's download.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot } from '../../../scripts/check-bundle.mjs';

const cardId = process.argv[2] ?? 'enclose-001';
const root = findRepoRoot();
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

const args = ['remotion', 'render', 'src/index.ts', 'EncloseShort', join(outDir, `${cardId}.mp4`), `--props=${JSON.stringify({ cardId })}`];
if (process.env.REMOTION_BROWSER_EXECUTABLE) args.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);

const result = spawnSync('npx', args, { stdio: 'inherit', cwd: join(root, 'apps', 'shorts') });
process.exit(result.status ?? 1);
