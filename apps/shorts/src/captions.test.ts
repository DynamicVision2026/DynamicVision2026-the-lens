import { getCard, loadBundle } from '@lens/scenes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readList } from '../scripts/list.mjs';
import { askSentence, captionsSection, shortFileName, UPLOAD, uploadCopy } from './captions';

const ids = [...new Set(Object.values(readList(readFileSync(join(__dirname, '..', 'shorts.yaml'), 'utf8'))).flat())];

describe('upload copy (WO-028 §2)', () => {
  it('lists cards that exist', () => {
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(getCard(id), id).toBeDefined();
  });

  it('every title ≤ 40 chars; every description has the VOICEVOX credit and ?src=yt', () => {
    const all = [...ids.map((id) => getCard(id)!), ...loadBundle().cards.filter((c) => c.kind === 'standard')];
    for (const card of all) {
      const c = uploadCopy(card);
      expect([...c.title].length, card.id).toBeLessThanOrEqual(UPLOAD.titleMax);
      expect(c.description).toContain('VOICEVOX:春日部つむぎ');
      expect(c.description).toContain('https://lens.domo-ai.com/?src=yt');
      expect(c.description.split('\n').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('follows the WO example and the stage hashtags', () => {
    const c = uploadCopy(getCard('constant-001')!);
    expect(c.title).toBe('【中学受験算数】3秒で選べ：和差一定');
    expect(c.description).toContain('#中学受験 #中受 #算数');
    expect(uploadCopy(getCard('kj-mirror-001')!).description).toContain('#高校受験');
    expect(uploadCopy(getCard('dj-freeze-001')!).description).toContain('#大学受験');
    expect(shortFileName(getCard('dj-freeze-001')!)).toBe('koko-freeze-dj-freeze-001.mp4');
    expect(captionsSection(c, 42)).toContain('constant-001');
  });

  it('makes no score claims', () => {
    for (const id of ids) expect(uploadCopy(getCard(id)!).description).not.toMatch(/点アップ|合格|偏差値|成績/);
  });

  it('takes the question sentence of the problem', () => {
    expect(askSentence('いま、A。Bは何年後ですか。')).toBe('Bは何年後ですか。');
    expect(askSentence('A。Bを求めなさい。ただし、C。')).toBe('Bを求めなさい。');
  });
});
