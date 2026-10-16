// Launch copy (WO-009, WO-013, WO-024), as written by the Architect. Do not edit without the Architect.
/**
 * WO-024: the 視点レンズ landing page, from the approved Lens.dc.html artboard (Brian, Oct 15), as written by
 * the Architect. Course sizes, the trap/lens times and which lens is free come from the bundle.
 */
export const LANDING = {
  logo: '視点レンズ',
  nav: { courses: 'コース', faq: 'よくある質問', owned: '購入済みの方' },
  eyebrow: '中学受験・高校受験・大学受験の算数／数学',
  h1: ['解き方の前に、', '見方を変える', '。'] as const,
  sub: '最初の一手を選ぶ力を、30日で。',
  lead: 'むずかしい問題で手が止まるのは、計算力ではなく「どこから見るか」が決まっていないから。視点レンズは、遠回りの「罠の道」と、見方を変える「レンズの道」を並べて、最初の一手を選ぶ練習をします。',
  tryFree: '3日間、無料でためす',
  seeCourses: 'コースと料金を見る',
  heroNote: '登録なし・カード不要。最初のレンズを3日間ためせます。',
  twoRoads: '同じ問題、2つの道。',
  roadsLead: 'ななめの四角形の面積。1辺の長さを出そうとすると、手が止まります。外側を長方形で「囲む」と、引き算だけで終わります。',
  trapRoad: '罠の道',
  trapPath: '辺の長さを出そうとする → ななめの長さが分からない → 三角形に分けて、また止まる',
  lensRoad: (lens: string) => `レンズの道（${lens}）`,
  lensPath: '外わくの長方形で囲む → すみの直角三角形を引く → 答え',
  roadsPoint: '速さの差は、才能ではなく「最初の一手」の差です。',
  trialHow: '無料体験のしくみ',
  trialSteps: [
    ['コースを選ぶ', '中学受験・高校受験・大学受験から、お子さんに合うコースを選んで「無料ではじめる」。登録もカードもいりません。'],
    ['最初のレンズを3日間', '1つ目のレンズのマスタークラス（6分・音声つき）と練習問題を、3日間何度でも使えます。'],
    ['続けるなら、購入', '購入すると、8つのレンズすべてと全問題が12か月ひらきます。メールのリンクから、すぐに続きを始められます。'],
  ] as const,
  lenses: '8つのレンズ',
  lensesLead: '「何を求めるか」ではなく「どこから見るか」。入試に何度も出てくる8つの見方を、1つずつ身につけます。',
  freeBadge: '無料でためせる',
  freeNote: '無料でためせるのは、各コースの最初のレンズです（中学受験・高校受験は「囲む」、大学受験は「てんびん」）。',
  lesson: '1つのレンズの進みかた',
  lessonSteps: [
    ['マスタークラス（6分・音声つき）', '罠の道とレンズの道を見くらべ、例題2問を指で動かして解きます。「このレンズが使えないとき」も学びます。'],
    ['練習（5問）', 'ヒントなしで「どのレンズ？」を選んでから解きます。'],
    ['4週間後のレポート', '最初の一手を選ぶまでの時間が、どう変わったかを保護者の方にお届けします。'],
  ] as const,
  lessonNote: '点数や順位はつけません。見るのは「正しい道具を、どれだけ早く選べたか」だけです。',
  courses: 'コースを選ぶ',
  launch: '2026年10月16日（金）公開',
  /** Per Pass: the audience line and blurb on its card (Architect's copy). */
  course: {
    chugaku_juken: { audience: '小5・小6 ・ 算数', blurb: '図形と文章題の「最初の一手」を、8つのレンズで。面積・速さ・食塩水・立体まで。' },
    koukou_juken: { audience: '中1〜中3 ・ 数学', blurb: '座標の図形と連立方程式の文章題を、方程式より速い見方で。三平方の展開図まで。' },
    daigaku_juken: { audience: '高1〜高3 ・ 共通テスト／個別試験', blurb: '1/6公式、定点、対称点、円すいの展開、確率の表。式を立てる前に「何を固定するか」。' },
  } as Record<string, { audience: string; blurb: string }>,
  rows: { content: '内容', term: '期間', free: '無料体験' },
  /** 「8つのレンズ・80問・マスタークラス8本」 from bundle.passes. */
  content: (lessons: number, problems: number) => `${lessons}つのレンズ・${problems}問・マスタークラス${lessons}本`,
  term: '12か月・自動更新なし',
  free: (lens: string) => `「${lens}」を3日間`,
  price: '¥6,800',
  priceNote: '（税込）創設メンバー30席',
  list: '通常価格 ¥9,800（税込）',
  buy: 'このコースを買う',
  trial: '無料ではじめる（3日間）',
  parents: 'おうちの方へ',
  parentsBody: '答えを教える教材ではありません。答えに入る前の「見方」を練習します。塾の宿題や過去問の前に、1日10分から使えます。',
  parentsNote: '点数や合格を保証するものではありません。',
  safety: '安心のために',
  safetyLines: ['アプリの中で、AIにはつながりません。', 'お子さんが名前などの個人情報を入力する場面はありません。', '広告・ランキングはありません。', 'ブラウザだけで使えます（iPad・スマホ・PC）。'],
  access: '購入済みの方',
  accessLine: 'ご購入後のメールにある「コースをひらく」リンクを、使う端末で一度ひらいてください。その端末でコースがひらき、無料体験の続きからそのまま進めます。ほかの端末でも、同じリンクをひらけば使えます。',
  accessHelp: (email: string) => `メールが見つからないときは ${email} までご連絡ください。`,
  faq: 'よくある質問',
  faqs: [
    ['無料体験は、どこまで使えますか？', '選んだコースの最初のレンズ（マスタークラスと練習問題）を、はじめた日から3日間使えます。登録やカードはいりません。体験の記録は、使っている端末に保存されます。'],
    ['3日たったら、どうなりますか？', '自動で料金がかかることはありません。続けたいときは、コースを購入してください。メールのリンクをひらくと、同じ端末なら体験の続きから進められます。'],
    ['返金はできますか？', 'ご購入から8日以内で、購入後にレッスンを一度もひらいていない場合は、全額返金いたします。詳しくは特定商取引法に基づく表記をご覧ください。'],
    ['何年生から使えますか？', '中学受験パスは小5〜小6、高校受験パスは中1〜中3、大学受験パスは高1〜高3が目安です。'],
    ['自動更新はありますか？', 'ありません。ご購入時に一度だけのお支払いで、12か月お使いいただけます。'],
    ['どの端末で使えますか？', 'iPad、スマートフォン、パソコンのブラウザで使えます。アプリのダウンロードはいりません。'],
    ['支払い方法は？', 'クレジットカード（Visa・Mastercard・American Express・JCB）、Apple Pay、Google Pay、Shop Pay、PayPal がお使いいただけます。'],
  ] as const,
  operator: '運営：Beyond Culture 獨歩文化株式会社',
  voice: '音声 VOICEVOX:春日部つむぎ',
  top: 'domo-ai.com トップへ',
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
  external: '外部送信について',
} as const;

/** WO-025: 電気通信事業法の外部送信規律による公表（/external）. */
export const EXTERNAL = {
  lede: 'このサイトは、コースをよりよくするために、ご利用の状況を次の事業者に送信しています。',
  rows: [
    ['送信先', 'Google LLC（Google アナリティクス）'],
    ['送信する情報', '見たページ、押したボタン、利用時間、本のQRコードから来たかどうか、ご購入の方は注文番号。お名前・メールアドレス・お子さまが入力した内容は送信しません。'],
    ['目的', 'コースの改善のため（どのページがよく見られ、どれくらい使われているかを知るため）。'],
    ['広告への利用', '広告には使いません。'],
  ],
  optOut: '送信を止めるには、Google アナリティクス オプトアウト アドオンをお使いください。',
  optOutTitle: '送信の停止',
  optOutUrl: 'https://tools.google.com/dlpage/gaoptout?hl=ja',
  google: 'Google のプライバシーポリシー',
  googleUrl: 'https://policies.google.com/privacy?hl=ja',
} as const;

export const PRIVACY = [
  '学習の記録（解いた時間や回数）は、お使いの端末の中だけに保存されます。',
  'お子さまの名前などの個人情報は集めません。',
  'ご購入時のお名前・メールアドレス・お支払い情報は、Shopify（決済）でのみ扱い、このアプリには届きません。',
  'サイトの利用状況の計測については「外部送信について」をご覧ください。',
] as const;

/** Approved by the Architect (#32, #52): the signup field and button, the sent line, the check link. */
export const PROPOSED = {
  emailLabel: 'メールアドレス',
  signupButton: '登録する',
  signupSent: '登録を受け付けました。開いたページで完了してください。',
  /** WO-013: the free check from the landing page. */
  checkLink: 'どのレンズ？チェック（無料・8問）',
} as const;
