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
  firstEdition: '初版発行',
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

/** The site address printed on the back cover (WO-021 §3). */
export const SITE_URL = 'https://lens.domo-ai.com/';
/** The back-cover QR target: the site, tagged as a book visit (WO-027; remembered as src=book on any page). */
export const BACK_QR_URL = `${SITE_URL}?src=book`;

/** Where a long book title breaks onto a second line (the cover and title page never break mid-word). */
export const TITLE_BREAK_BEFORE = 'ワークブック';

/** 「視点レンズ 中学受験算数ワークブック」 → [「視点レンズ 中学受験算数」, 「ワークブック」]. */
export function titleLines(title: string): string[] {
  const i = title.indexOf(TITLE_BREAK_BEFORE);
  if (i <= 0) return [title];
  return [title.slice(0, i).trim(), title.slice(i)];
}

/**
 * WO-026 §7 MUST 2: はじめに paragraphs split only at line breaks (\n), never at spaces. A space after a
 * sentence end (YAML folding) is dropped: Japanese puts none between sentences.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.replace(/([。！？」）])[ \t]+/g, '$1').trim())
    .filter(Boolean);
}

/** The first `n` whole sentences (each ends with 「。」), for the back-cover excerpt: never cut mid-sentence. */
export function sentences(text: string, n: number): string {
  const all = paragraphs(text).join('').match(/[^。]+。/g) ?? [];
  return all.slice(0, n).join('');
}

/**
 * WO-026 §7 SHOULD 7: the printed time strip. 60 s and more in 分, seconds only when non-zero, and an
 * estimate reads 「約…」 instead of 「+4分0秒 目安」 (a tester median keeps its 実測 badge).
 */
export function bookTime(seconds: number, source: 'estimate' | 'tester_median'): string {
  const total = Math.max(0, Math.round(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  const text = `${min > 0 ? `${min}分` : ''}${sec > 0 || min === 0 ? `${sec}秒` : ''}`;
  return source === 'estimate' ? `約${text}` : text;
}

/** WO-026 §7 SHOULD 8: the colophon date, 「2026年10月16日 初版発行」 (from --date YYYY-MM-DD). */
export function colophonDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日 ${COPY.firstEdition}`;
}
