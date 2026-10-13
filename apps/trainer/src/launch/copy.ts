// Launch copy (WO-009), as written in the work order. Do not edit without the Architect.
export const LANDING = {
  eyebrow: '中学受験の算数',
  h1: '計算する前に、「見方」を選ぶ。',
  sub: '同じ問題でも、見方を変えると30秒で解ける。『視点レンズ』は、その"見方"を1つずつ身につける算数トレーナーです。',
  heroCaption: 'ななめの四角形の面積も、「囲む」と見えればすぐに出せる。',
  start: '無料でためす（3分）',
  points: [
    '8つのレンズ：囲む・ずらす・展開・止める・てんびん・面積図・折り返す・差一定',
    '解き方の前に「どのレンズか」を選ぶ練習。まちがえても、なぜちがうかが分かる。',
    'かかった時間を記録。同じ型の問題で、どれだけ速くなったかが分かる。',
  ],
} as const;

export const SIGNUP = {
  title: '無料版の続きと、新しいレンズの公開をメールでお知らせします',
  consent: '登録すると、視点レンズからのお知らせメールを受け取ることに同意したことになります。いつでも解除できます。',
} as const;

export const PREORDER = {
  title: '先行予約（30家庭限定）',
  stage: '第1ステージ（中学受験）',
  listPrice: '¥9,800',
  arrow: '→',
  earlyPrice: '先行価格 ¥6,800',
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

/**
 * Not in WO-009 (proposed; needs the Architect's OK): the email field's accessible name and button,
 * and the line shown after a signup is sent.
 */
export const PROPOSED = {
  emailLabel: 'メールアドレス',
  signupButton: '登録する',
  signupSent: '登録を受け付けました。開いたページで完了してください。',
  /** WO-013: the free check from the landing page (proposed; the WO gives no copy). */
  checkLink: 'どのレンズ？チェック（無料・8問）',
} as const;
