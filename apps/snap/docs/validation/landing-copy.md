# Lens Snap — 先行登録ページ コピー

For `src/copy.ts`. The block below is valid TypeScript; paste it as is. Section order matches WO-001 §4 screen 1: pain → promise → how it works → what it is not → FAQ → waitlist → footer.

Rules this copy follows (keep them when editing):
- No score / grade-improvement claims (景品表示法). Benefits are only *time saved* and *knowing what to do*.
- Privacy lines match WO-001 §0: photos are saved on the device; the server passes one image to the reader and keeps nothing. Do not shorten this to "写真は外に出ません" — the image does leave the phone briefly.
- Subject is 算数・数学 only (data/units.json). Grades: 小学生・中学生.
- Placeholders in `{BRACES}` are for the founder to fill.

```ts
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
  },

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
        a: "小学1年生から中学3年生までの算数・数学を予定しています。ほかの教科は、ご要望を伺いながら検討します。",
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
```

## Hero headline A/B (founder)

| Variant | Headline | Chars | Angle |
|---|---|---|---|
| Default | 撮るだけで、やることがわかる。 | 15 | The promise (what you get) |
| A | 今夜、何を復習すればいい？ | 13 | The anchor pain, as the parent's own question |
| B | テスト前の夜を、迷わない夜に。 | 15 | The night scene, resolved |

Measure each by waitlist sign-up rate (form submits ÷ unique visitors). Run one variant at a time per Shorts traffic wave if traffic is small.
