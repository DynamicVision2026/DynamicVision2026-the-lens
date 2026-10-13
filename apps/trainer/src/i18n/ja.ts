// UI strings (ADR-002): components call t('key'); card text keeps coming from the bundle.
// guide.*: STUB(architect #46) — copy owned by the Architect (WO-012 §3b), here until it has a home
// in labels/. Shared lines are as written in §3b; per-lens play lines are the Founder MVP's.
export const ja = {
  'case.title': 'レンズケース',
  'case.lede': '8つの道具から1つ選んで、まず「どのレンズで見るか」を選び、それから図を指で動かして答えにたどり着こう。',
  'case.planned': '準備中',
  'case.locked': '2027年1月公開・先行予約で解放',
  'case.count': '{n}問',
  'lesson.back': '← ケース',
  'lesson.backLabel': 'レンズケースへ',
  'lesson.pickTitle': 'どのレンズで見る？',
  'lesson.trapLead': 'よくある考え方：',
  'lesson.tryOn': '{lens}で見ると…',
  'lesson.clueTitle': 'どこを見て、{lens}にした？',
  'lesson.clueRight': 'そこが手がかり。では、指で確かめよう。',
  'lesson.clueWrong': 'それは別のレンズの手がかり。もう1つ選んでみよう。',
  'lesson.next': '次の問題 →',
  'lesson.toCase': 'レンズケースへ',
  'lesson.again': 'もう一度さわる',
  'lesson.notFound': 'このレッスンは見つかりません',
  'guide.pick': 'どの道具で見る？',
  'guide.pickRight': 'それだ！',
  'guide.pickWrong': 'おしい！ そのレンズだと、どうなるかな？',
  'guide.clue': '決め手になった言葉はどこかな？',
  'guide.clueRight': 'そこだね！ 指でたしかめよう',
  'guide.aha': 'やったね！ 見方を変えたら、すぐ解けた！',
  'guide.enclose.box': '角の ● をドラッグして、図形をぴったり囲もう',
  'guide.enclose.retry': '外わくの頂点に、ぴったり合わせよう',
  'guide.slide.apex': '上の ● を直線ℓにそってドラッグしてみよう',
  'guide.slide.retry': '頂点を、ℓの上の1点に集めよう',
  'guide.slide.same': '面積の合計は 変わらない',
  'guide.mirror.flip': 'Q の ● をつかんで、川の向こうへ折り返そう',
  'guide.mirror.x': 'X を動かして、P から Q′ までを まっすぐにしよう',
  'guide.mirror.right': 'もう少し右。折れ線がまっすぐになる所',
  'guide.mirror.left': 'もう少し左。折れ線がまっすぐになる所',
} as const;

export type Key = keyof typeof ja;

/** The string for a key, with {name} placeholders filled. */
export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return ja[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
