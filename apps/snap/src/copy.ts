/**
 * All user-facing copy in one place.
 *
 * `copy` = the landing page (final copy from docs/validation/landing-copy.md, pasted as is).
 * Placeholder handling: {CONTACT_EMAIL} → contact line omitted for now; {PRIVACY_URL} → /privacy
 * (see PRIVACY_PATH). `app` = the in-app UI copy.
 */
export const copy = {
  meta: {
    title: "Lens Snap｜撮るだけで、テスト前に「やること」がわかる",
    description:
      "宿題・ドリル・返ってきたテストを撮っておくだけ。問題を単元ごとに整理し、テスト前には復習すべき問題だけの一覧をつくります。小学生・中学生の算数・数学向け。",
  },

  hero: {
    // 15文字。A/B用の別案は下の heroAlternatives を参照
    headline: "撮るだけで、やることがわかる。",
    subline:
      "宿題もドリルも、返ってきたテストも。撮っておけば、テスト前の夜に「今夜はこれをやればいい」がすぐにわかります。",
    cta: "先行登録する（無料）",
    note: "小学生・中学生の算数・数学から始めます",
  },

  heroAlternatives: {
    a: "今夜、何を復習すればいい？", // 13文字：痛みをそのまま問いかける案
    b: "テスト前の夜を、迷わない夜に。", // 15文字：夜の情景に寄せた案
    c: "間違い直しノート、撮るだけで。", // 中学受験の親（手書きの間違い直しノート）向け
  },

  // Variant-specific sublines (default: hero.subline)
  heroSublineAlternatives: {
    c: "切って貼って、書き写して…の間違い直しノートづくりを、写真1枚に。間違えた問題だけが単元ごとにたまり、テスト前の「やることリスト」になります。",
  } as Partial<Record<"a" | "b" | "c", string>>,

  pain: {
    heading: "テスト前の夜、こんなことはありませんか？",
    lines: [
      "どこから復習させればいいのか、正直わからない。",
      "返ってきたテスト、どこにしまったんだっけ。",
      "ドリルを最初からやり直す時間は、もうない。",
    ],
  },

  promise: {
    heading: "撮るだけで、テスト前に「やること」がわかる。",
    body:
      "ふだんの宿題やドリル、返ってきたテストを撮っておくだけ。テスト前には、間違えた問題だけが単元ごとに並びます。探す時間も、迷う時間も、ぐっと少なくなります。",
  },

  howItWorks: {
    heading: "使い方は3ステップ",
    steps: [
      {
        title: "撮る",
        body: "宿題・ドリル・返ってきたテストを、スマホで撮ります。",
      },
      {
        title: "自動で整理",
        body:
          "問題を1問ずつ読み取り、学習指導要領の単元ごとに整理します。先生の○✕も、そのまま記録します。",
      },
      {
        title: "テスト前リスト",
        body:
          "テスト範囲の単元を選ぶと、「やるべき問題」だけのリストができあがります。",
      },
    ],
  },

  notThis: {
    heading: "Lens Snap がしないこと",
    items: [
      {
        title: "点数アップをお約束するものではありません",
        body:
          "採点もしません。先生がつけた○✕を、そのまま記録するだけです。Lens Snap がお手伝いするのは、テスト前に「何をやるか」を決めるところです。",
      },
      {
        title: "答えを教えるアプリではありません",
        body:
          "問題を解いたり、答えを表示したりはしません。考えるのは、お子さま自身です。",
      },
      {
        title: "写真は、お使いのスマホの中に保存されます",
        body:
          "読み取りのときだけ写真が一度サーバーを通りますが、私たちが写真を保存することはありません。お子さまのお名前も読み取りません。",
      },
    ],
  },

  faq: {
    heading: "よくあるご質問",
    items: [
      {
        q: "料金はいくらですか？",
        a: "公開時の料金は、まだ決まっていません。決まり次第、先行登録いただいた方に最初にメールでお知らせします。先行登録だけで料金がかかることはありません。",
      },
      {
        q: "撮った写真や個人情報はどう扱われますか？",
        a: "写真はお使いのスマホ（ブラウザ）の中に保存されます。読み取りのときだけ一度サーバーを通りますが、私たちが写真を保存することはなく、お子さまのお名前も読み取りません。先行登録でお預かりするのは、メールアドレスと学年だけです。",
      },
      {
        q: "何年生が使えますか？",
        a: "小学1年生から高校生までの算数・数学を予定しています（まずは小学生・中学生から始めます）。ほかの教科は、ご要望を伺いながら検討します。",
      },
      {
        q: "どの教科書やテストに対応していますか？",
        a: "教科書会社ではなく学習指導要領の単元で整理するため、教科書の種類を問わずお使いいただけます。学校のテスト、市販のドリル、塾のプリントも撮影できます。手書きの答えや先生の○✕も読み取ります。",
      },
      {
        q: "読み取りはどのくらい正確ですか？",
        a: "保存する前に、読み取った内容を必ず画面で確認でき、単元や○✕はタップひとつで直せます。写りが暗いときは撮り直しをお願いすることもあります。実際のプリントでの精度は、先行登録の方にご協力いただきながら確かめていきます。",
      },
    ],
  },

  waitlist: {
    heading: "先行登録（無料）",
    lead: "完成したら、いち早くお知らせします。",
    emailLabel: "メールアドレス",
    emailPlaceholder: "example@mail.com",
    gradeLabel: "お子さまの学年",
    gradePlaceholder: "選択してください",
    gradeOptions: [
      "小学1年生",
      "小学2年生",
      "小学3年生",
      "小学4年生",
      "小学5年生",
      "小学6年生",
      "中学1年生",
      "中学2年生",
      "中学3年生",
      "高校生",
      "その他",
    ],
    // アンケートQ1と同じ選択肢（数字を比べられるように揃えています）
    painLabel: "テスト前、何を復習するか迷いますか？",
    painOptions: ["毎回", "よくある", "たまに", "ない"],
    submit: "先行登録する",
    submitting: "送信しています…",
    privacyNote:
      "メールアドレスは、Lens Snap に関するお知らせにのみ使います。いつでも配信を止められます。",
    errors: {
      emailRequired: "メールアドレスを入力してください。",
      emailInvalid: "メールアドレスの形式をご確認ください。",
      gradeRequired: "お子さまの学年を選んでください。",
      network: "送信できませんでした。お手数ですが、もう一度お試しください。",
    },
    thanks: {
      heading: "ご登録ありがとうございます",
      body:
        "準備ができ次第、ご登録のメールアドレスにお知らせします。もうしばらくお待ちください。",
    },
  },

  footer: {
    brand: "Lens Snap ― 視点レンズ",
    brandUrl: "https://lens.domo-ai.com",
    company: "運営：Beyond Culture 獨歩文化株式会社",
    contactLabel: "お問い合わせ",
    contact: "{CONTACT_EMAIL}",
    privacyLabel: "プライバシーポリシー",
    privacyUrl: "{PRIVACY_URL}",
    copyright: "© 2026 Beyond Culture 獨歩文化株式会社",
  },
} as const;

export const PRIVACY_PATH = "/privacy";
export type HeroVariant = "default" | keyof typeof copy.heroAlternatives;
export const HERO_VARIANTS = ["default", "a", "b", "c"] as const satisfies readonly HeroVariant[];

/** Small UI strings for the landing / privacy pages that are not marketing copy. */
export const landingUi = {
  backToTop: "トップへ戻る",
  privacyIntro: "Lens Snap での写真と個人情報の扱いについて。",
};

export const app = {
  nav: { snap: "撮る", report: "レポート", map: "マップ", list: "テスト前", archive: "ふりかえり" },
  onboarding: {
    title: "学年を選んでください",
    body: "その学年の単元で整理します。あとから変えられます。",
    start: "はじめる",
  },
  snap: {
    title: "ページを撮りましょう",
    body: "宿題・ドリル・テストを1ページずつ撮ってください。",
    camera: "カメラで撮る",
    file: "写真を選ぶ",
    reading: "読み取っています…",
    retake: "もう少し明るい所で撮り直してください。",
    retry: "撮り直す",
    error: "読み取れませんでした。もう一度お試しください。",
    privacy: "写真はこの端末にだけ保存されます。",
    rateLimited: "短い時間にたくさん読み取りました。1時間ほどあけて、もう一度お試しください。",
    dailyCap: "今日の読み取りは上限に達しました。明日またお試しください。",
    pilotAgain: "招待コードが違うようです。もう一度入力してください。",
  },
  pilot: {
    title: "招待コードを入力してください",
    body: "Lens Snap はいま、招待した方だけにお使いいただいています。お知らせした招待コードを入力してください。",
    label: "招待コード",
    submit: "つづける",
    retry: "コードを送って読み取る",
  },
  confirm: {
    title: "読み取り結果の確認",
    body: "単元と○✕が合っているか確かめて、保存してください。",
    problem: (n: number) => `問題 ${n}`,
    unit: "単元",
    noUnit: "単元を選んでください",
    answer: "こたえ",
    noAnswer: "（空欄）",
    mark: "先生の印",
    none: "なし",
    low: "読み取りに自信がありません",
    save: "保存する",
    cancel: "やめる",
    empty: "問題が見つかりませんでした。",
    score: (s: string) => `点数 ${s}`,
    notes: "メモ",
  },
  map: {
    title: "単元マップ",
    body: "✕がある単元は赤、テストで全問○になった単元は金色になります。",
    problems: (n: number) => `${n}問`,
    wrong: (n: number) => `✕ ${n}`,
    star: "★",
    legend: { review: "復習が必要", ok: "✕なし・復習ずみ", gold: "マスター（テストで全問○）", empty: "まだありません" },
    own: "あなたの学年",
    units: (n: number) => `${n}単元`,
    sum: { review: (n: number) => `復習 ${n}`, gold: (n: number) => `★ ${n}`, ok: (n: number) => `済 ${n}` },
    unfiled: (n: number) => `単元が未選択の問題が ${n} 問あります。`,
    toList: "テスト前リストへ",
    litToast: (n: number, lit: boolean) =>
      lit ? `${n}問を保存しました。光っている単元に入りました。` : `${n}問を保存しました。`,
    toReport: "レポートを見る",
    // 単元星図
    skyBody: "下から上へ、学年ごとに単元がつながっています。",
    view: { sky: "星図", list: "一覧" },
    viewLabel: "表示のしかた",
    lanes: { num: "数と計算", geo: "図形", rel: "変化と関係", data: "データ" },
    skyLegend: { review: "復習が必要", ok: "復習ずみ", gold: "マスター", empty: "まだ" },
    status: { review: "復習が必要", ok: "復習ずみ", gold: "マスター（テストで全問○）", empty: "まだ問題がありません" },
    gradeSummary: (g: string) => `${g}の単元`,
    count: { review: (n: number) => `復習 ${n}`, ok: (n: number) => `復習ずみ ${n}`, gold: (n: number) => `マスター ${n}`, empty: (n: number) => `まだ ${n}` },
    chartLabel: "単元マップ（星図）。下が小1、上が高校です。",
    openBand: (g: string) => `${g}の単元をひらく`,
    fold: "たたむ",
    starLabel: (grade: string, code: string, topic: string, status: string) => `${grade} ${code} ${topic}、${status}`,
    sheet: {
      problems: "問題",
      wrong: "✕",
      state: "状態",
      roots: "もとになる単元",
      noRoots: "この単元が、この列のいちばん下です。",
      open: "この単元の問題を見る",
      close: "閉じる",
    },
  },
  install: {
    title: "ホーム画面に追加しませんか",
    ios: "ホーム画面に追加すると、アプリのように開けて、撮った問題が消えにくくなります。共有ボタン（□↑）→「ホーム画面に追加」",
    android: "ホーム画面に追加すると、アプリのように開けて、撮った問題が消えにくくなります。",
    add: "ホーム画面に追加",
    dismiss: "閉じる",
  },
  backup: {
    title: "バックアップ",
    body: "撮った問題はこの端末の中にだけあります。機種変更や、ブラウザのデータ削除にそなえて、ときどき保存してください。",
    save: "バックアップを保存",
    restore: "バックアップから戻す",
    last: (d: string) => `最後のバックアップ：${d}`,
    never: "まだバックアップしていません。",
    remind: "そろそろバックアップを保存しておくと安心です。",
    restored: (n: number) => `${n}ページを戻しました。`,
    nothingNew: "新しいページはありませんでした（すべてこの端末にあります）。",
    invalid: "このファイルは読み込めませんでした。Lens Snap で保存したバックアップのファイル（.json）を選んでください。",
    failed: "保存できませんでした。もう一度お試しください。",
    date: (m: number, d: number) => `${m}月${d}日`,
  },
  list: {
    title: "テスト前リスト",
    body: "テスト範囲の単元を選んでください。",
    readiness: "準備度",
    noData: "この範囲にはまだ問題がありません。",
    allDone: "この範囲の✕はありません。よくがんばりました。",
    reviewed: "復習した",
    wrong: "✕",
    low: "要確認",
    yourAnswer: "こたえ",
    count: (n: number) => `${n}問`,
    chooseUnits: "単元を選ぶと、今夜やる問題が出てきます。",
    onlyNennotame: "選んだ単元で、今夜やる問題はありません。念のための見直しは下にあります。",
    nennotame: "念のため（最新のページでは全問○の単元）",
    nennotameNote: "新しいページでは全問○でした。時間があるときに見直してください。",
  },
  report: {
    title: (g: string) => `${g}の学習レポート`,
    meta: (date: string, pages: number) => `最後に撮った日：${date} ・ これまでに${pages}ページ`,
    barLabel: "単元ごとのようす",
    of: (n: number) => `${n}単元のうち`,
    state: { gold: "マスター", ok: "復習ずみ", review: "復習が必要", empty: "まだ" },
    stateHint: {
      gold: "最新のページで全問○",
      ok: "✕は復習ずみ",
      review: "復習していない✕がある",
      empty: "まだ問題がない",
    },
    next: "次にやること",
    wrong: (n: number) => `✕ ${n}問`,
    openList: "テスト前リストで見る",
    noNext: "今、復習が必要な単元はありません。新しいプリントやテストを撮ると、ここに表示されます。",
    earlier: "前の学年で気になる単元",
    earlierBody: "今の学年の単元のもとになる単元です。",
    supports: (grade: string, topic: string) => `${grade}「${topic}」のもと`,
    week: "この1週間",
    weekPages: "撮ったページ",
    weekProblems: "問題",
    weekWrong: "✕のついた問題",
    units: "単元",
    toMap: "単元マップで全体を見る",
    emptyTitle: "撮ると、ここにレポートができます",
    emptyBody:
      "宿題・ドリル・テストを撮っておくと、単元ごとのようすがこの1ページにまとまります。全問○の単元、復習が必要な単元、この1週間に撮った量が、ひと目でわかります。",
    emptyCta: "ページを撮る",
  },
  archive: {
    title: "ふりかえり",
    allUnits: "すべての単元",
    onlyWrong: "✕だけ",
    period: { all: "すべての日付", today: "今日", week: "この7日", month: "この30日" },
    delete: "このページを削除",
    confirmDelete: "このページを削除しますか？",
    empty: "保存したページはまだありません。",
    page: (d: string, n: number) => `${d}・${n}問`,
  },
  grade: { change: "学年を変える" },
  pageType: { test: "テスト", drill: "ドリル", note: "ノート", other: "プリント" } as Record<string, string>,
};
