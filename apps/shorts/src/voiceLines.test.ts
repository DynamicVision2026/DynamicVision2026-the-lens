// The Shorts' voice script (WO-028 §1): every spoken line of every card in shorts.yaml, as the voice
// reads it. tools/make_voice.py turns apps/shorts/voice/lines.json into clips; this test keeps the file
// in step with the template.   Update it with:  pnpm --filter @lens/shorts voice:lines
import { getCard, loadBundle, shortLines } from '@lens/scenes';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readList } from '../scripts/list.mjs';

const app = join(__dirname, '..');
const FILE = join(app, 'voice', 'lines.json');

export function voiceScript(): Record<string, Record<string, string>> {
  const ids = [...new Set(Object.values(readList(readFileSync(join(app, 'shorts.yaml'), 'utf8'))).flat())];
  const labels = loadBundle().labels.lenses;
  return Object.fromEntries(
    ids.map((id) => {
      const card = getCard(id);
      if (!card) throw new Error(`shorts.yaml lists "${id}", which is not in the bundle`);
      return [id, Object.fromEntries(shortLines(card, labels[card.lens]?.ja ?? card.lens).map((l) => [l.key, l.speech]))];
    }),
  );
}

describe('voice script', () => {
  it('apps/shorts/voice/lines.json matches the Shorts in shorts.yaml', () => {
    const want = `${JSON.stringify(voiceScript(), null, 2)}\n`;
    if (process.env.UPDATE_VOICE_LINES) writeFileSync(FILE, want);
    expect(readFileSync(FILE, 'utf8'), 'run: pnpm --filter @lens/shorts voice:lines').toBe(want);
  });
});
