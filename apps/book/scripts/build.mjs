// Runs src/build.ts through Vite's SSR loader (TSX + the bundle JSON import), so the book needs no
// separate TS runner. Usage: pnpm --filter @lens/book build <passId> [--date YYYY-MM-DD]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { assertBundle } from '../../../scripts/check-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assertBundle(root);
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
let code = 1;
try {
  const { main } = await server.ssrLoadModule('/src/build.ts');
  code = await main(process.argv.slice(2));
} finally {
  await server.close();
}
process.exit(code);
