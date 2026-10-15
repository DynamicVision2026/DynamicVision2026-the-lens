// Launch copy (WO-009, WO-013, WO-024), as written by the Architect. Do not edit without the Architect.
/**
 * WO-024: the 視点レンズ landing page (same section order as the ナゼホリ standard), as written by the
 * Architect. The trap/lens times and every course number come from the bundle, never from here.
 */
export const LANDING = {
  logo: '視点レンズ',
  owned: '購入済みの方',
  h1: ['解き方の前に、', '見方を変える', '。'] as const,
  sub: '最初の一手を選ぶ力を、30日で。',
  lead: 'むずかしい問題で手が止まるのは、計算力ではなく『どこから見るか』が決まっていないから。視点レンズは、遠回りの『罠の道』と、見方を変える『レンズの道』を並べて、最初の一手を選ぶ練習をします。',
  choose: 'コースを選ぶ',
  check: '3分の無料チェック',
  twoRoads: '同じ問題、2つの道。',
  /** {t}: the card's trap / lens time (「約4分」, 「約30秒」). */
  trapRoad: (time: string) => `罠の道：式を立てて、場合分けして、${time}。`,
  lensRoad: (time: string) => `レンズの道：見方を1つ変えて、${time}。`,
  roadsPoint: '速さの差は、才能ではなく『最初の一手』の差です。',
  lenses: '8つのレンズ',
  lesson: '1つのレンズの進みかた',
  lessonSteps: [
    ['マスタークラス（6分・音声つき）', '例題2問と「使えないとき」'],
    ['練習', '5問、ヒントなしで「どのレンズ？」'],
    ['4週間後のレポート', '判断時間の変化を保護者に'],
  ] as const,
  courses: 'コースを選ぶ',
  founder: '創設メンバー30席 ¥6,800（税込）',
  list: '通常価格 ¥9,800',
  term: '12か月利用・自動更新なし',
  buy: 'このコースを買う',
  badge: '2026年10月16日 公開',
  /** 「8レッスン・80問」 from bundle.passes. */
  size: (lessons: number, problems: number) => `${lessons}レッスン・${problems}問`,
  parents: 'おうちの方へ',
  parentsLines: ['答えを教える教材ではありません。答えに入る前の『見方』を練習します。', '点数や合格を保証するものではありません。'],
  safety: '安心のために',
  safetyLines: ['アプリの中でAIにはつながりません', 'お子さんが個人情報を入力する場面はありません', '広告・ランキングはありません', 'ブラウザだけで使えます（iPad・スマホ・PC）'],
  access: '購入済みの方',
  accessLine: 'ご購入後のメールにある『コースをひらく』リンクを、使う端末で一度ひらいてください。その端末でコースがひらきます。ほかの端末でも、同じリンクをひらけば使えます。',
  faq: 'よくある質問',
  faqs: [
    ['返金は？', 'ご購入から8日以内で、レッスンを一度も開いていない場合は全額返金。詳しくは特商法ページ'],
    ['どの端末で？', 'ブラウザだけで使えます（iPad・スマホ・PC）'],
    ['何年生から？', '中学受験：小5〜小6、高校受験：中1〜中3、大学受験：高1〜高3'],
    ['自動更新は？', 'ありません'],
    ['支払い方法は？', 'Shopifyの決済：クレジットカード、Apple Pay、Google Pay、Shop Pay、PayPal'],
  ] as const,
} as const;

/** WO-024 /open: the access link's answer when the key doesn't match. */
export const OPEN = {
  wrong: 'リンクが正しくありません。ご購入時のメールのリンクをもう一度ひらいてください。',
  help: 'ひらけないときは、こちらへご連絡ください：',
  opening: 'コースをひらいています…',
} as const;

export const SIGNUP = {
  title: '無料版の続きと、新しいレンズの公開をメールでお知らせします',
  consent: '登録すると、視点レンズからのお知らせメールを受け取ることに同意したことになります。いつでも解除できます。',
} as const;

export const FOOTER = {
  privacy: 'プライバシー',
  tokushoho: '特定商取引法に基づく表記',
  contact: 'お問い合わせ',
  company: '運営会社',
} as const;

export const PRIVACY = [
  '学習の記録（解いた時間や回数）は、お使いの端末の中だけに保存されます。',
  'お子さまの名前などの個人情報は集めません。',
  'メールアドレスは、ご登録いただいた場合のみ、お知らせの送信に使います。',
] as const;

/** Approved by the Architect (#32, #52): the signup field and button, the sent line, the check link. */
export const PROPOSED = {
  emailLabel: 'メールアドレス',
  signupButton: '登録する',
  signupSent: '登録を受け付けました。開いたページで完了してください。',
  /** WO-013: the free check from the landing page. */
  checkLink: 'どのレンズ？チェック（無料・8問）',
} as const;
