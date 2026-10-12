# WO-009 · Launch site: landing page → Free Lens → preorder

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 27 · **Depends on:** WO-003 step 2 merged (the picker and the Time-Saved report)

## Goal

The page a parent lands on from a Short. It explains the idea in one screen, starts the Free Lens (`/play/enclose-001`), captures an email, and ends at the ¥6,800 preorder. This is the Nov 5 launch; everything after it (WO-004 → WO-008) adds lenses.

## Scope (`apps/trainer`, static, no backend)

**Routes**

| Route | What |
| --- | --- |
| `/` | Landing page (copy below) |
| `/play/enclose-001` | Free Lens (from WO-003). Its report's preorder button now goes to the real URL |
| `/privacy` | Short privacy note (copy below) |

**Config, one file** `apps/trainer/src/launch.config.ts`, values filled in by the founder:

```ts
export const LAUNCH = {
  shopDomain: 'TODO.myshopify.com',        // Shopify store (customer signup form posts here)
  preorderUrl: 'https://TODO/products/…',   // ¥6,800 preorder product
  tokushohoUrl: 'https://TODO/policies/legal-notice', // 特定商取引法 page on the store
  cfAnalyticsToken: '',                       // Cloudflare Web Analytics; empty = no script
};
```

**Email signup:** a plain HTML form that POSTs to `https://{shopDomain}/contact#contact_form` with `form_type=customer`, `utf8=✓`, `contact[email]`, `contact[tags]=free-lens,{short}` and `contact[accepts_marketing]=true`. This creates a Shopify customer with marketing consent; no API keys and no backend. One email field and one button; a consent line under it. Shown on the landing page and at the end of the Free Lens report (before the preorder button).

**Short tracking:** each Short links to `/?s=<card-id>` (for example `/?s=enclose-001`). Keep `s` in `sessionStorage` (via `safeStorage`) and add it to the signup tags and to the preorder link as `?utm_source=short&utm_content=<s>`.

**Analytics:** Cloudflare Web Analytics script tag only when `cfAnalyticsToken` is set (cookie-free, no banner). Count these as page paths or link clicks; no extra library: landing view, Free Lens start (`/play/…`), report shown, signup submit, preorder click.

**Style:** tokens only, light theme, the same figure from `LensScene` (enclose-001 at its `show_answer` keyframe) as the hero. iPad landscape first, works at 390×844. No images other than SVG scenes.

## Copy (Japanese, use as written)

Landing `/`:
- Eyebrow: 中学受験の算数
- H1: 計算する前に、「見方」を選ぶ。
- Sub: 同じ問題でも、見方を変えると30秒で解ける。『視点レンズ』は、その"見方"を1つずつ身につける算数トレーナーです。
- Hero caption under the figure: ななめの四角形の面積も、「囲む」と見えればすぐに出せる。
- Button: 無料でためす（3分）  → `/play/enclose-001`
- 3 points (icon + one line each):
  - 8つのレンズ：囲む・ずらす・展開・止める・てんびん・面積図・折り返す・差一定
  - 解き方の前に「どのレンズか」を選ぶ練習。まちがえても、なぜちがうかが分かる。
  - かかった時間を記録。同じ型の問題で、どれだけ速くなったかが分かる。
- Signup block title: 無料版の続きと、新しいレンズの公開をメールでお知らせします
- Consent line: 登録すると、視点レンズからのお知らせメールを受け取ることに同意したことになります。いつでも解除できます。
- Preorder block: 先行予約（30家庭限定）／ 第1ステージ（中学受験）¥9,800 → 先行価格 ¥6,800 ／ 2027年1月にお届け。1月31日までにお届けできない場合は全額返金します。 Button: 先行予約する
- Footer links: プライバシー（`/privacy`）・特定商取引法に基づく表記（`tokushohoUrl`）

Privacy `/privacy`:
- 学習の記録（解いた時間や回数）は、お使いの端末の中だけに保存されます。
- お子さまの名前などの個人情報は集めません。
- メールアドレスは、ご登録いただいた場合のみ、お知らせの送信に使います。

No exam-score claims anywhere; "same-type problem" wording stays as in WO-003.

## Acceptance

- [ ] `/` → 無料でためす → full Free Lens → report → signup → preorder link, on iPad Safari (or simulator) and a 390×844 phone viewport.
- [ ] Signup form posts the right fields to the configured store (check the request in devtools against a test store or the real one).
- [ ] `?s=enclose-001` reaches the signup tags and the preorder UTM.
- [ ] Works in a private window; no console errors; analytics script absent when the token is empty.
- [ ] Copy matches this WO exactly; no hex literals; tokens only.
- [ ] Nothing under `cards/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.

## Founder / Coordinator, in parallel (not code)

1. Shopify: preorder product ¥6,800, inventory 30, Vendor 視点レンズ, delivery January 2027 and the refund rule in the description. Send the product URL.
2. 特定商取引法 page on the store covering preorder delivery and refunds. Send its URL.
3. Shopify Email: welcome mail for customers tagged `free-lens` (+ the 3-mail sequence later).
4. Cloudflare Pages: connect the repo (build `pnpm bundle && pnpm build`, output `apps/trainer/dist`); turn on Web Analytics and send the token.
5. One test order, then refund it.
