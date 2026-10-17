// WO-028 §2: upload copy per Short (title ≤ 40 chars, a 2–3 line description with the VOICEVOX credit and
// the ?src=yt link, hashtags). Built from the card and this file's fixed copy only; no score claims.
import { loadBundle, SHORT_COPY, type LensCard } from '@lens/scenes';

export const UPLOAD = {
  link: 'https://lens.domo-ai.com/?src=yt',
  credit: '音声 VOICEVOX:春日部つむぎ',
  titleMax: 40,
  subject: { shogakko: '中学受験算数', chugaku: '高校受験数学', koko: '大学受験数学' } as Record<string, string>,
  hashtags: {
    shogakko: ['#中学受験', '#中受', '#算数'],
    chugaku: ['#高校受験', '#数学'],
    koko: ['#大学受験', '#数学'],
  } as Record<string, string[]>,
  brandTag: '#視点レンズ',
  tryLine: '無料でためす →',
} as const;

export interface UploadCopy {
  cardId: string;
  file: string;
  title: string;
  description: string;
}

const lensName = (lens: string) => loadBundle().labels.lenses[lens]?.ja ?? lens;

/** out/shorts/<stage>-<lens>-<cardId>.mp4 */
export function shortFileName(card: LensCard): string {
  return `${card.stage}-${card.lens}-${card.id}.mp4`;
}

/** The question part of the problem: its last sentence, e.g. 「…3倍になるのは何年後ですか。」 */
export function askSentence(text: string): string {
  const parts = text.split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
  const ask = parts.filter((s) => !s.startsWith('ただし')).pop() ?? text;
  return ask;
}

export function uploadCopy(card: LensCard): UploadCopy {
  const name = lensName(card.lens);
  const title = `【${UPLOAD.subject[card.stage] ?? card.stage}】${SHORT_COPY.hook.replace('。どこから解く？', '')}：${name}`;
  const tags = [...(UPLOAD.hashtags[card.stage] ?? []), UPLOAD.brandTag];
  const description = [
    `${askSentence(card.problem.text_ja)} ${SHORT_COPY.hook.split('。')[1]}`,
    `${name}レンズ：${card.trigger.ja}`,
    `${UPLOAD.tryLine} ${UPLOAD.link}`,
    UPLOAD.credit,
    tags.join(' '),
  ].join('\n');
  return { cardId: card.id, file: shortFileName(card), title, description };
}

export const CAPTIONS_HEADER = ['# 視点レンズ Shorts: upload copy (WO-028)', '', 'Music: none (voice only). Paste title and description as they are.', ''].join('\n');

/** captions.md section for one video, ready to paste into YouTube Studio. */
export function captionsSection(c: UploadCopy, seconds: number): string {
  return [`## ${c.file}`, '', `- Card: \`${c.cardId}\``, `- Length: ${seconds.toFixed(1)} s`, '', '**Title**', '', '```', c.title, '```', '', '**Description**', '', '```', c.description, '```', ''].join('\n');
}
