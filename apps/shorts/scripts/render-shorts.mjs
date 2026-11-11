// WO-028 §2 batch render. One bundle, one MP4 per listed card, plus captions.md with the upload copy.
//   pnpm render:shorts                       # every card in apps/shorts/shorts.yaml (review + batch)
//   pnpm render:shorts --list review         # one section of shorts.yaml
//   pnpm render:shorts constant-001 …        # given card ids
//   pnpm render:shorts --stills …            # a snapshot frame per beat instead of the MP4s
//   pnpm render:shorts --look euclid …       # the alternative look (ruler-and-compass, whip pans)
// Output: out/shorts/<stage>-<lens>-<cardId>.mp4 and out/shorts/captions.md (repo root, git-ignored).
// Set REMOTION_BROWSER_EXECUTABLE to use an installed Chromium instead of Remotion's download.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRepoRoot } from '../../../scripts/check-bundle.mjs';
import { readList } from './list.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const root = findRepoRoot();
const outDir = join(root, 'out', 'shorts');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);

const lists = readList(readFileSync(join(app, 'shorts.yaml'), 'utf8'));
const named = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--list' && argv[i - 1] !== '--look');
// --look euclid renders the alternative style (files end in -euclid.mp4); the default is nebula.
const look = opt('--look') ?? 'nebula';
const section = opt('--list');
const ids = named.length > 0 ? named : section ? (lists[section] ?? []) : Object.values(lists).flat();
if (ids.length === 0) throw new Error(`No cards to render (shorts.yaml section "${section ?? 'all'}" is empty).`);

mkdirSync(outDir, { recursive: true });
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
console.log(`Bundling apps/shorts for ${ids.length} Short(s)…`);
const serveUrl = await bundle({ entryPoint: join(app, 'src', 'index.ts'), publicDir: join(app, 'public') });

const copies = [];
for (const cardId of ids) {
  const composition = await selectComposition({ serveUrl, id: 'LensShort', inputProps: { cardId, look }, browserExecutable });
  const upload = composition.props.upload;
  if (flag('--stills')) {
    const frames = composition.props.stillFrames ?? [];
    for (const [label, frame] of frames) {
      const file = join(outDir, 'stills', `${cardId}${look === 'nebula' ? '' : `-${look}`}_${label}.png`);
      mkdirSync(dirname(file), { recursive: true });
      await renderStill({ serveUrl, composition, inputProps: { cardId, look }, frame, output: file, browserExecutable });
    }
    console.log(`  ${cardId}: ${frames.length} stills`);
    continue;
  }
  const output = join(outDir, upload.file);
  await renderMedia({ serveUrl, composition, inputProps: { cardId, look }, codec: 'h264', outputLocation: output, browserExecutable, imageFormat: 'jpeg', jpegQuality: 90, concurrency: Number(process.env.SHORTS_CONCURRENCY) || null });
  console.log(`  ${upload.file}  ${upload.seconds.toFixed(1)} s`);
  copies.push(upload);
}

if (copies.length > 0) {
  const md = [copies[0].markdownHeader, ...copies.map((c) => c.markdown)].join('\n');
  writeFileSync(join(outDir, look === 'nebula' ? 'captions.md' : `captions-${look}.md`), md);
  console.log(`Wrote out/shorts/captions.md (${copies.length} video(s)).`);
}
