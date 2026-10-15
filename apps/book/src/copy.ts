// Fixed headings of the paperback (WO-021 §2). Problem content, numbers and answers never live here:
// they come from build/bundle.json.
export const COPY = {
  hajimeni: 'はじめに',
  tsukaikata: 'この本の使い方',
  contents: '目次',
  chapter: (n: number) => `第${n}章`,
  principle: 'このレンズの考え方',
  qrCaption: '動かして確かめる',
  example: (n: number) => `例題${n}`,
  trap: 'くせでやると',
  lens: 'レンズで見ると',
  time: '時間',
  trigger: 'こんなときに使う',
  boundarySame: 'レンズが使えないとき',
  boundaryOther: 'ここは別のレンズ',
  boundaryLine: 'ここがポイント',
  practice: '練習',
  similar: '類題',
  whichLens: 'どのレンズ？',
  review: '「どのレンズ？」総まとめ',
  reviewLead: '単元をまぜた問題です。使うレンズの□に印をつけてから解きましょう。',
  reviewShort: '総まとめ',
  answers: '答え',
  answerLens: 'レンズ',
  memo: 'メモ',
  colophon: '奥付',
  author: '著者',
  publisher: '発行',
  published: '発行日',
  copyright: '© Beyond Culture',
  draftDate: '（発行日未定）',
  figurePending: '図（準備中）',
  // Lever end labels and the frozen walker, as in the trainer (apps/trainer i18n balance.* / guide.freeze.stopped).
  water: '水 0%',
  salt: '食塩 100%',
  stopped: '止める',
  backQrCaption: 'Webアプリ「視点レンズ」',
} as const;

/** Problem numbers within a chapter: ①…⑳, ㉑…㊿, then plain numbers. */
export function circled(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  return `(${n})`;
}

/** The back-cover QR target (WO-021 §3). */
export const SITE_URL = 'https://lens.domo-ai.com/';

/** Where a long book title breaks onto a second line (the cover and title page never break mid-word). */
export const TITLE_BREAK_BEFORE = 'ワークブック';

/** 「視点レンズ 中学受験算数ワークブック」 → [「視点レンズ 中学受験算数」, 「ワークブック」]. */
export function titleLines(title: string): string[] {
  const i = title.indexOf(TITLE_BREAK_BEFORE);
  if (i <= 0) return [title];
  return [title.slice(0, i).trim(), title.slice(i)];
}
