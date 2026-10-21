/**
 * All user-facing copy in one place.
 *
 * `copy` = the landing page (final copy from docs/validation/landing-copy.md, pasted as is).
 * Placeholder handling: {CONTACT_EMAIL} → contact line omitted for now; {PRIVACY_URL} → /privacy
 * (see PRIVACY_PATH). `app` = the in-app UI copy.
 */
/**
 * Our official YouTube channel ナゼホリ数学: one link for every unit (no per-unit mapping to maintain).
 * The unit sheet opens the channel's search for the unit's topic, the map menu the channel home.
 */
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@Domo-ai";

export const copy = {
  meta: {
    title: "つまずきマップ｜撮るだけで、何を復習すればいいかわかる",
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
    heading: "つまずきマップ がしないこと",
    items: [
      {
        title: "点数アップをお約束するものではありません",
        body:
          "点数はつけません。○✕は、先生の印があればそれを記録し、印のない宿題やドリルはAIが判定します（保護者の方がいつでも直せます）。つまずきマップ がお手伝いするのは、テスト前に「何をやるか」を決めるところです。",
      },
      {
        title: "答えを丸写しするためのアプリではありません",
        body:
          "○✕を確かめるための正答は、確認画面に小さく表示するだけです。解き方を考えるのは、お子さま自身です。",
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
      "高校1年生",
      "高校2年生",
      "高校3年生",
      "その他",
    ],
    // アンケートQ1と同じ選択肢（数字を比べられるように揃えています）
    painLabel: "テスト前、何を復習するか迷いますか？",
    painOptions: ["毎回", "よくある", "たまに", "ない"],
    submit: "先行登録する",
    submitting: "送信しています…",
    privacyNote:
      "メールアドレスは、つまずきマップ に関するお知らせにのみ使います。いつでも配信を止められます。",
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
    brand: "つまずきマップ ― ナゼホリ数学",
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
  privacyIntro: "つまずきマップ での写真と個人情報の扱いについて。",
};

export const app = {
  nav: { map: "マップ", snap: "撮る", list: "テスト前", archive: "ふりかえり", backToMap: "マップにもどる" },
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
    body: "つまずきマップ はいま、招待した方だけにお使いいただいています。お知らせした招待コードを入力してください。",
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
    mark: "○✕",
    none: "なし",
    low: "読み取りに自信がありません",
    unitCheck: "単元を確認してください",
    unitSuggest: "候補",
    source: { teacher: "先生の印", ai: "AI判定", parent: "" } as Record<"teacher" | "ai" | "parent", string>,
    correctAnswer: (a: string) => `正答（AI）：${a}`,
    disagree: "先生の印とAIの判定がちがいます。印を確認してください。",
    save: "保存する",
    cancel: "やめる",
    empty: "問題が見つかりませんでした。",
    score: (s: string) => `点数 ${s}`,
    notes: "メモ",
    photo: "撮った写真",
  },
  map: {
    title: "単元マップ",
    body: "単元ごとに5段階で記録します。復習していない✕がある単元は赤（挑戦中）、最新のページで全問○の単元は金色（マスター）、2週間以上あけてもう一度全問○なら「定着」です。",
    problems: (n: number) => `${n}問`,
    wrong: (n: number) => `✕ ${n}`,
    star: "★",
    legend: {
      settled: "定着（2週間以上あけてもう一度全問○）",
      master: "マスター（最新のページで全問○）",
      reviewed: "復習ずみ（✕なし・✕は復習ずみ）",
      trying: "挑戦中（復習していない✕がある）",
      mada: "まだありません",
    } as Record<"mada" | "trying" | "reviewed" | "master" | "settled", string>,
    own: "あなたの学年",
    units: (n: number) => `${n}単元`,
    sum: {
      settled: (n: number) => `定着 ${n}`,
      master: (n: number) => `★ ${n}`,
      reviewed: (n: number) => `済 ${n}`,
      trying: (n: number) => `挑戦中 ${n}`,
    } as Record<"trying" | "reviewed" | "master" | "settled", (n: number) => string>,
    unfiled: (n: number) => `単元が未選択の問題が ${n} 問あります。`,
    litToast: (n: number, lit: boolean) =>
      lit ? `${n}問を保存しました。光っている単元に入りました。` : `${n}問を保存しました。`,
    toReport: "レポートを見る",
    // Toast right after 保存 (built by savedToast in lib/home.ts)
    saved: {
      head: (n: number) => `${n}問を保存しました`,
      wrong: (n: number, topics: string[], more: boolean) =>
        topics.length > 0 ? `✕ ${n}問（${topics.join("、")}${more ? " ほか" : ""}）` : `✕ ${n}問`,
      ok: (n: number) => `○ ${n}問`,
      none: (n: number) => `印なし ${n}問`,
    },
    // Floating button on the map
    fab: "撮る",
    fabLabel: "ページを撮る",
    // 領土マップ (the same map as the video 「日本の算数・数学マップ」)
    terr: {
      chartLabel: "単元マップ。小1の海岸線から高3の山頂まで、学年ごとの地帯がつながる大陸です。ドラッグで移動、ピンチや＋−で拡大・縮小できます。",
      hudTitle: (g: string) => `制覇（${g}）`,
      hudLabel: (g: string, n: number, total: number, levels: string) => `${g}で制覇した単元 ${n}／${total}${levels ? `、${levels}` : ""}`,
      next: (n: number) => `次にやること ${n}`,
      nextLabel: (n: number) => `次にやること ${n}単元。赤い旗の単元へ順に移動します`,
      nextOf: (i: number, n: number) => `次へ（${i}/${n}）`,
      here: "現在地",
      hereLabel: (g: string) => `現在地（${g}）にもどる`,
      // 算数・数学の大陸: one zone per grade, coast → summit
      zones: {
        小1: "海岸線", 小2: "入り江", 小3: "平原", 小4: "森林帯", 小5: "深い森林帯", 小6: "湖沼帯",
        中1: "丘陵帯", 中2: "岩稜帯", 中3: "高原帯", 高1: "雪線", 高2: "氷河帯", 高3: "山頂",
      } as Record<string, string>,
      elevation: (m: number) => `標高 ${m.toLocaleString("ja-JP")}`,
      youAreHere: "あなたはここ",
      progress: (n: number, total: number) => `制覇 ${n}/${total}`,
      conquered: "制覇",
      zoneLabel: (zone: string, g: string, n: number, total: number, levels = "") => `${g} ${zone}：制覇 ${n}／${total}${levels ? `（${levels}）` : ""}`,
      menu: "メニュー",
      year: {
        title: "年度の記録",
        note: "4月〜3月を1年度として、この端末の記録から作っています。",
        label: (y: number) => `${y}年度`,
        wrong: (n: number) => `✕ ${n}`,
        empty: "まだ記録がありません。プリントを撮ると、年度ごとに残ります。",
        go: (y: number, g: string, zone: string) => `${y}年度（${g} ${zone}）の地帯へ移動`,
        close: "閉じる",
      },
      zoomIn: "拡大",
      zoomOut: "縮小",
      list: "一覧で見る",
      legend: "凡例",
      strands: { num: "数と計算 / 数と式", geo: "図形", rel: "測定・変化と関係 / 関数", data: "データの活用", hs: "高校（科目ごとの色）" },
      empty: { body: "プリントを撮ると、その単元が自分の領土になります", cta: "ページを撮る" },
      history: "これまでのページ",
      historyRow: { wrong: (n: number) => `✕${n}`, ok: (n: number) => `○${n}`, none: (n: number) => `印なし${n}` },
      historyMore: (n: number) => `ほか ${n}ページ`,
      noHistory: "まだこの単元のページはありません。プリントを撮ると、ここに記録されます。",
    },
    view: { sky: "マップ", list: "一覧" },
    viewLabel: "表示のしかた",
    sheet: {
      problems: "問題",
      wrong: "✕",
      state: "状態",
      roots: "もとになる単元",
      noRoots: "この単元が、この分野のいちばん最初の単元です。",
      open: "この単元の問題を見る",
      report: "学習レポート",
      close: "閉じる",
      // layer 4 inside the sheet: this unit's problems (newest first)
      toList: "テスト前リストで見る",
      grow: "シートを広げる",
      shrink: "シートを縮める",
      historyOpen: (date: string, type: string) => `${date} ${type}のページを見る`,
      historyAll: (n: number) => `ほか ${n}ページを表示`,
      problemsCount: (n: number) => `${n}問`,
      noProblems: "この単元の問題はまだありません。",
      nennotame: "念のため",
      nennotameNote: "最新のページでは全問○でした。時間があるときに見直してください。",
      problemNo: (n: number) => `問${n}`,
      yourAnswer: "こたえ",
      blank: "（空欄）",
      noMark: "印なし",
      source: { teacher: "先生の印", ai: "AI判定", parent: "保護者" } as Record<"teacher" | "ai" | "parent", string>,
      low: "要確認",
      more: "続きを読む",
      less: "たたむ",
      photoOpen: (date: string, type: string, n: number) => `${date} ${type}・問${n}のページを開く`,
      noPhoto: "写真なし",
    },
    // full-screen page viewer over the map (from a thumbnail or a history row)
    viewer: {
      label: (date: string, type: string) => `${date} ${type}のページ`,
      close: "閉じる",
      count: (n: number) => `${n}問`,
      noPhoto: "このページの写真は保存されていません。",
      zoomHint: "ピンチまたはダブルタップで拡大できます",
      reset: "元の大きさ",
      problems: "このページの問題",
      thisUnit: (topic: string) => `この単元（${topic}）`,
      noUnit: "単元なし",
    },
  },
  // 5-step mastery ladder (lib/ladder.ts): names, hints, the sheet's ladder bar and next-step line
  ladder: {
    names: { mada: "まだ", trying: "挑戦中", reviewed: "復習ずみ", master: "マスター", settled: "定着" } as Record<
      "mada" | "trying" | "reviewed" | "master" | "settled",
      string
    >,
    hints: {
      mada: "まだ問題がない",
      trying: "復習していない✕がある",
      reviewed: "✕はすべて復習ずみ",
      master: "最新のページで全問○",
      settled: "2週間以上あけてもう一度全問○",
    } as Record<"mada" | "trying" | "reviewed" | "master" | "settled", string>,
    count: (name: string, n: number) => `${name} ${n}`,
    sep: " ・ ",
    barLabel: (step: number, name: string) => `習熟の段階：5段階のうち${step}段目「${name}」`,
    next: {
      mada: "この単元のページを撮ると、記録が始まります。",
      trying: "✕の問題を解き直して「復習した」にすると『復習ずみ』です。",
      reviewed: "次のページで全問○なら『マスター』です。",
      master: (md: string) => `2週間後にもう一度全問○なら『定着』です（${md}以降）。`,
      masterNow: "次のページでもう一度全問○なら『定着』です。",
      settled: "いちばん上の段です。ときどき解き直して、保ちましょう。",
    },
  },
  // One link to our YouTube channel (YOUTUBE_CHANNEL_URL); opens in a new tab / the YouTube app
  video: {
    button: "解説動画（YouTube）",
    note: "動画がまだない単元もあります",
    unitLabel: (topic: string) => `解説動画（YouTube）：ナゼホリ数学のチャンネルで「${topic}」を探す（新しいタブで開きます）`,
    channelLabel: "解説動画（YouTube）：ナゼホリ数学のチャンネルを開く（新しいタブで開きます）",
  },
  // テスト前モード on the map: 「今夜、何を復習すればいい？」 (no scores, no promise of results)
  exam: {
    mode: "テスト前モード",
    modeLabel: "テスト前モード：テストの日と範囲から、今夜の復習の作戦をつくります",
    close: "テスト前モードを閉じる",
    countdown: (n: number) => (n <= 0 ? (n === 0 ? "テストは今日" : "テストの日は過ぎました") : `テストまで あと${n}日`),
    // step 1: the date
    when: "テストはいつですか？",
    whenNote: "日付と範囲から、今夜やることをしぼります。",
    tomorrow: "明日",
    dayAfter: "あさって",
    pick: "日付を選ぶ",
    pickLabel: "テストの日付",
    pickOk: "この日にする",
    weekdays: "日月火水木金土",
    dayChoice: (md: string, wd: string) => `${md}（${wd}）`,
    // step 2: the range, picked on the map
    rangeAsk: "範囲の単元を選んでください",
    rangeHint: "単元をタップすると、範囲に入れたり外したりできます。",
    zoneAll: "この地帯を全部",
    zoneNone: "この地帯を外す",
    zoneAllLabel: (g: string, zone: string) => `${g} ${zone}の単元をすべて範囲に入れる`,
    zoneNoneLabel: (g: string, zone: string) => `${g} ${zone}の単元をすべて範囲から外す`,
    rangeCount: (n: number) => `範囲 ${n}単元`,
    rangeNone: "まだ選ばれていません",
    decide: "決定",
    inRange: "範囲に入っています",
    notInRange: "範囲外",
    // the plan (今夜の作戦)
    plan: "今夜の作戦",
    whenTitle: (n: number, md: string, wd: string) =>
      n === 0 ? "今日のテスト" : n === 1 ? "明日のテスト" : n === 2 ? "あさってのテスト" : `${md}（${wd}）のテスト`,
    rangeUnits: (n: number) => `範囲 ${n}単元`,
    tonight: (n: number, min: number) => `今夜やること：${n}問 ・ めやす 約${min}分`,
    tonightNone: "今夜やること：0問",
    progress: (done: number, total: number) => `復習した ${done} / ${total}`,
    first: "まず解き直す",
    firstNote: "範囲の単元で、まだ復習していない✕です。新しいものから。",
    roots: "つまずきのもと",
    rootsNote: "範囲の単元のもとになる、前の学年の単元の✕です。",
    rootFor: (grade: string, topic: string, supports: string) => `${grade} ${topic} — ${supports} のもと`,
    extra: "念のため",
    extraNote: "最新のページで全問○だった単元の前の✕と、読み取りに自信がない問題です。時間があれば。",
    count: (n: number) => `${n}問`,
    missing: (first: string, more: number) => `まだ撮っていない単元：${first}${more > 0 ? ` ほか${more}` : ""}`,
    missingNote: "撮っていない単元は、作戦に入れられません。",
    snap: "撮る",
    check: "答えを確かめる",
    checkHide: "答えをかくす",
    checkFirst: "まず自分で解き直してから確かめましょう。",
    noAnswer: (photo: boolean) =>
      photo ? "正答（AI）はありません。写真の問題で確かめてください。" : "正答（AI）はありません。教科書やプリントで確かめてください。",
    overview: "今夜の作戦の内訳",
    overviewDone: "済",
    rowDone: (n: number) => `${n}問 済`,
    secured: (unit: string) => `${unit}：✕をすべて復習しました（復習ずみ）`,
    reviewed: "復習した",
    doneTitle: "今夜の作戦は完了です",
    doneBody: "おつかれさまでした。あとは早めに休みましょう。",
    doneExtra: (n: number) => `時間があれば、念のための見直しがあと${n}問あります。`,
    nothing: "範囲の単元に、今夜解き直す✕はありません。",
    noData: "範囲の単元のページがまだありません。プリントを撮ると、作戦をつくれます。",
    changeRange: "日付・範囲を変える",
    share: "共有用にまとめる",
    // the parent summary (screenshot or Web Share as text; nothing is uploaded)
    summary: "テスト前の作戦",
    summaryRange: "範囲",
    summaryPlan: "今夜の作戦",
    summaryProgress: "進みぐあい",
    summaryNote: "この画面はスクリーンショットで残せます。「文章で共有する」で送るのはこの内容の文章だけで、写真や記録はアップロードされません。",
    shareText: "文章で共有する",
    copied: "文章をコピーしました",
    shareFailed: "共有できませんでした",
    summaryClose: "作戦にもどる",
    summaryWhen: (title: string, md: string) => `${title}（${md}）`,
    summaryLine: (label: string, what: string) => `${label}：${what}`,
    signature: "つまずきマップ で作成",
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
    invalid: "このファイルは読み込めませんでした。つまずきマップ で保存したバックアップのファイル（.json）を選んでください。",
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

    next: "次にやること",
    wrong: (n: number) => `✕ ${n}問`,
    openList: "テスト前リストで見る",
    noNext: "今、挑戦中の単元はありません。新しいプリントやテストを撮ると、ここに表示されます。",
    earlier: "前の学年で気になる単元",
    earlierBody: "今の学年の単元のもとになる単元です。",
    supports: (grade: string, topic: string) => `${grade}「${topic}」のもと`,
    week: "この1週間",
    weekPages: "撮ったページ",
    weekProblems: "問題",
    weekWrong: "✕のついた問題",
    units: "単元",
    toMap: "単元マップで全体を見る",
    backToMap: "単元マップにもどる",
    emptyTitle: "撮ると、ここにレポートができます",
    emptyBody:
      "宿題・ドリル・テストを撮っておくと、単元ごとのようすがこの1ページにまとまります。全問○の単元、挑戦中の単元、この1週間に撮った量が、ひと目でわかります。",
    emptyCta: "ページを撮る",
  },
  // Plans: a one-time free trial (30 photos per device, no monthly reset) and the 1-year pass (¥5,800, tax included; 総額表示):
  // 200 photos a month per pass, shared by its devices. No 「使い放題」: say the monthly number.
  plan: {
    title: "プラン",
    free: "無料のお試し",
    freeLeft: (n: number, limit: number) => `お試し：あと${n}枚（${limit}枚まで無料）`,
    trialNote: "お試しは1回かぎりです（毎月のリセットはありません）。",
    pass: "年間プラン",
    passUntil: (day: string) => `${day}まで有効`,
    passFromCode: "コードで有効になっています",
    passFromOrder: "ご購入ありがとうございます",
    expired: "年間プランの有効期限が切れました。続けて使うには、もう一度ご購入ください。",
    chipFree: (n: number) => `お試し あと${n}枚`,
    chipPass: "年間プラン",
    chipLabel: "プランを見る",
    quotaTitle: (limit: number) => `お試しの${limit}枚を使い切りました。年間プランなら毎月200枚まで使えます`,
    quotaBody: "これまでの記録・テスト前の作戦・単元マップは、いつも通り使えます。",
    seePlan: "年間プランを見る",
    price: "¥5,800",
    priceUnit: "／年（税込）",
    perDay: "1日あたり約16円",
    benefits: ["月200枚まで（毎月1日にリセット）", "家族の端末3台まで", "テスト前モード・学習レポートも、これまで通り"],
    buy: "年間プランを購入する",
    buyNote: "Beyond Culture のストアが開きます。購入後、このページの「購入済みの方」から有効にしてください。",
    oneTime: "1年分のお支払いです。自動更新はありません。",
    claimTitle: "購入済みの方",
    claimBody: "ご注文確認メールにある注文番号と、購入時のメールアドレスを入力してください。",
    orderLabel: "注文番号（メールの「注文番号」の数字）",
    emailLabel: "メールアドレス",
    claim: "有効にする",
    codeTitle: "講座をお持ちの方・コードをお持ちの方",
    codeBody: "お知らせしたコード（LS-から始まる12文字）を入力してください。コードの1年は、はじめて入力した日から始まります。",
    codeLabel: "コード",
    redeem: "コードで有効にする",
    working: "確認しています…",
    yourCode: "このプランのコード",
    codeNote: "家族の端末（3台まで）でも、このコードを入力すると使えます。控えておいてください。",
    done: "年間プランが有効になりました",
    monthTitle: "今月の撮影枚数",
    monthCount: (used: number, limit: number, pct: number) => `${used}／${limit}枚（${pct}%）`,
    monthLeft: (left: number, day: string) => `あと${left}枚・${day}にリセットされます`,
    passValid: (day: string) => `年間プラン：${day}まで有効`,
    monthLow: (left: number) => `今月の残りが少なくなっています（あと${left}枚）`,
    monthOut: (limit: number, day: string) => `今月の撮影枚数（${limit}枚）を使い切りました。${day}にリセットされます。`,
    monthOutKeep: "これまでの記録・テスト前の作戦・単元マップは、いつも通り使えます。",
    chipMonth: (used: number, limit: number) => `今月 ${used}／${limit}枚`,
    deviceLimit: "このプランはすでに3台の端末で使われています。",
    errors: {
      not_found: "注文が見つかりません。注文番号とメールアドレスをご確認ください。",
      not_paid: "お支払いが確認できない注文です。",
      no_pass_item: "この注文には年間プランが含まれていません。",
      expired: "有効期限が切れています。",
      device_limit: "このプランはすでに3台の端末で使われています。",
      bad_code: "コードが正しくないようです。もう一度ご確認ください。",
      invalid: "注文番号とメールアドレスを入力してください。",
      rate_limited: "短い時間に何度も試しました。1時間ほどあけて、もう一度お試しください。",
      unavailable: "いま確認できません。しばらくしてから、もう一度お試しください。",
      error: "うまくいきませんでした。通信状態をご確認のうえ、もう一度お試しください。",
    },
    offline: "プランの情報を読み込めませんでした。",
    privacyTitle: "無料のお試し・年間プランで保存する情報",
    privacyBody:
      "無料の枚数を数えるため、端末ごとにランダムな番号（お名前やメールアドレスとは結びつきません）と、読み取った枚数を保存します。年間プランを注文番号で有効にするときは、ストアにご注文を確認し、注文の番号・有効期限と、メールアドレスを復元できない形に変換した値だけを保存します。メールアドレスそのものは保存しません。",
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
  grade: {
    change: "学年を変える",
    // Shown once after the old combined 「高校」 was read as 高1 (19 Oct 2026)
    migrated: (g: string) => `学年を「${g}」にしました。高2・高3のときは、右上の学年をタップして変えてください。`,
    ok: "このままでよい",
  },
  pageType: { test: "テスト", drill: "ドリル", note: "ノート", other: "プリント" } as Record<string, string>,
};
