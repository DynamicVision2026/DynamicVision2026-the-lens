// Launch copy (WO-009, WO-010 Masterclass copy and the founder pricing from the #52 check), as
// written by the Architect. Do not edit without the Architect. Prices, seats, term and devices come
// from bundle.passes, so the copy can't drift from the catalog.
export const LANDING = {
  eyebrow: '中学受験の算数',
  h1: '計算する前に、「見方」を選ぶ。',
  sub: '同じ問題でも、見方を変えると30秒で解ける。『視点レンズ』は、その"見方"を1つずつ身につける算数トレーナーです。',
  heroCaption: 'ななめの四角形の面積も、「囲む」と見えればすぐに出せる。',
  start: '無料でためす（3分）',
  points: [
    '8回のマスタークラス：1回に1つのレンズ（囲む・ずらす・展開・止める・てんびん・面積図・折り返す・差一定）',
    '解き方の前に「どのレンズか」を選ぶ練習。まちがえても、なぜちがうかが分かる。',
    'かかった時間を記録。同じ型の問題で、どれだけ速くなったかが分かる。',
  ],
} as const;

export const SIGNUP = {
  title: '無料版の続きと、新しいレンズの公開をメールでお知らせします',
  consent: '登録すると、視点レンズからのお知らせメールを受け取ることに同意したことになります。いつでも解除できます。',
} as const;

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

/** The founder offer (Architect, #52): no struck-through "regular" price before it has been charged. */
export const PREORDER = {
  title: (seats: number) => `創設メンバー募集（先着${seats}家庭）`,
  stage: '中学受験パス（新小5・新小6）',
  price: (early: number, seats: number, list: number) => `創設メンバー価格 ${yen(early)}（先着${seats}家庭）。${seats + 1}家庭目からは通常価格 ${yen(list)}`,
  /** Proposed wording for the seats-left line (the number comes from launch.config.ts). */
  seatsLeft: (n: number) => `残り ${n} 家庭`,
  includes: (termMonths: number, devices: number) => [
    '8回のマスタークラス（1回に1つのレンズ）',
    '各レンズの解説動画（3〜5分）：わな・しくみ・使いどころ',
    '各レンズ10問以上、基礎から発展まで（全80問以上・すべてオリジナル問題）',
    '同じ型の練習問題は何度でも（数字が毎回かわります）',
    '「このレンズが使えない問題」と「レンズを使わない方が速い問題」つき',
    '総まとめ：8つのレンズを混ぜた「どのレンズ？」問題',
    '保護者レポート：かかった時間と、得意・苦手なレンズ',
    `${termMonths === 12 ? '1年間' : `${termMonths}か月`}・${devices}台まで利用できます`,
  ],
  delivery: '2027年1月にお届け。1月31日までにお届けできない場合は全額返金します。',
  button: '先行予約する',
} as const;

export const FOOTER = {
  privacy: 'プライバシー',
  tokushoho: '特定商取引法に基づく表記',
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
