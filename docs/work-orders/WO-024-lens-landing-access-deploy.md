# WO-024: 視点レンズ landing page, access links, own Cloud Run service (launch Fri Oct 16)

**Owner:** Builder · **Review:** Architect visual check · **Target:** Fri Oct 16 morning (JST). Brian, Oct 15: all three Passes launch the same day; domo-ai.com shows a cover page with two products, and 視点レンズ has its **own** landing page and purchase path.

## Isolation rule (Brian, Oct 15 17:04): non-negotiable
ナゼホリ (repo `kodomo-ai`) and 視点レンズ (this repo) share **only the domain name**. Never read from, write to, deploy to, or depend on ナゼホリ's repo, Cloud Run services, database, login or APIs. 視点レンズ stays a static site: no server, no database, no account system.

## 1. Address
- 視点レンズ lives at **https://lens.domo-ai.com** (its own Cloud Run service, §4). The cover page at domo-ai.com links its 視点レンズ card here.
- `launch.config.ts`: `siteUrl: 'https://lens.domo-ai.com'`. `apps/book/src/copy.ts` `SITE_URL`: the same (the Architect updates the books' QR URLs in `catalog/*/book.yaml` in this PR's sibling).

## 2. Landing page at `/` (replace the single-Pass preorder page)
Same standard and section order as the ナゼホリ landing page (kodomo-ai `src/lp/NewLandingPage.tsx`, read only as a reference for structure; copy nothing from that repo's code). Layout: one column, white cards on the existing Lens tokens, one primary button colour, stacks at phone width. All Japanese copy goes in `launch/copy.ts`; the Architect's copy is below.

| # | section | content |
|---|---|---|
| 1 | Header | 「視点レンズ」 logo text · right: 「購入済みの方」 (→ `#access`) |
| 2 | Hero | h1 「解き方の前に、<mark>見方を変える</mark>。」 · sub 「最初の一手を選ぶ力を、30日で。」 · lead 「むずかしい問題で手が止まるのは、計算力ではなく『どこから見るか』が決まっていないから。視点レンズは、遠回りの『罠の道』と、見方を変える『レンズの道』を並べて、最初の一手を選ぶ練習をします。」 · buttons: primary 「コースを選ぶ」 (→ `#courses`), secondary 「3分の無料チェック」 (→ `/check`) |
| 3 | Navy band | h2 「同じ問題、2つの道。」 · 「罠の道：式を立てて、場合分けして、約3分。」「レンズの道：見方を1つ変えて、約40秒。」 · 「速さの差は、才能ではなく『最初の一手』の差です。」 Use one real card's numbers from the bundle (`chugaku_juken` enclose example1: trap_route / lens_route time_cost_sec), not invented ones. |
| 4 | 8 lenses grid | h2 「8つのレンズ」 · 8 white cards from `labels/lenses.yaml` (icon + name + one-line hint), 2 columns on phone |
| 5 | One lesson | h2 「1つのレンズの進みかた」 · ① マスタークラス（6分・音声つき）：例題2問と「使えないとき」 ② 練習：5問、ヒントなしで「どのレンズ？」 ③ 4週間後のレポート：判断時間の変化を保護者に |
| 6 | Courses (`id="courses"`) | h2 「コースを選ぶ」 · three cards from `bundle.passes` (title_ja, audience_ja, lesson count, problem count) · each: 「創設メンバー30席 ¥6,800（税込）」 / 「通常価格 ¥9,800」 / 「12か月利用・自動更新なし」 · button 「このコースを買う」 → that Pass's Shopify product URL (§3 config) · badge 「2026年10月16日 公開」 |
| 7 | For parents | h2 「おうちの方へ」 · 「答えを教える教材ではありません。答えに入る前の『見方』を練習します。」「点数や合格を保証するものではありません。」 |
| 8 | Safety | h2 「安心のために」 · アプリの中でAIにはつながりません / お子さんが個人情報を入力する場面はありません / 広告・ランキングはありません / ブラウザだけで使えます（iPad・スマホ・PC） |
| 9 | Access (`id="access"`) | h2 「購入済みの方」 · 「ご購入後のメールにある『コースをひらく』リンクを、使う端末で一度ひらいてください。その端末でコースがひらきます。ほかの端末でも、同じリンクをひらけば使えます。」 |
| 10 | FAQ | 返金（ご購入から8日以内で、レッスンを一度も開いていない場合は全額返金。詳しくは特商法ページ）/ どの端末で？ / 何年生から？（中学受験：小5〜小6、高校受験：中1〜中3、大学受験：高1〜高3）/ 自動更新は？（ありません）/ 支払い方法は？（Shopifyの決済：クレジットカード、Apple Pay、Google Pay、Shop Pay、PayPal）|
| 11 | Footer | 特定商取引法に基づく表記 → `LAUNCH.tokushohoUrl` · お問い合わせ → mailto:info@domo-ai.com · 運営会社 → https://beyondculture.ai · 「VOICEVOX:春日部つむぎ」 |

Remove the 準備中 waitlist section (WO PR #75): all three Passes are on sale.

## 3. Access links (soft lock, no server)
- `launch.config.ts` gains `passes: { chugaku_juken: { shopUrl, key }, koukou_juken: {…}, daigaku_juken: {…} }`. Shop URLs: `https://soul-id-2.myshopify.com/products/lens-chugaku`, `…/lens-koukou`, `…/lens-daigaku`. Keys: one random 16-character string per Pass (generate once, commit; the Architect puts the same strings in the Shopify order email).
- New route `/open?p=<passId>&k=<key>`: if the key matches, remember `lens.v1.unlock.<passId> = 1` in localStorage (try/catch; on failure keep it in memory for the session) and go to that Pass's course home. Wrong key: a friendly line 「リンクが正しくありません。ご購入時のメールのリンクをもう一度ひらいてください。」 and the support email.
- `passOpen(passId)`: open if unlocked, or with `?preview=1`. `LAUNCH.lessonsPublic` stays for the free `/check` only. The free 3-minute check stays free.
- Catalog: in this PR, set all three Passes in `catalog/*/pass.yaml` to `status: live` (one-line change each, allowed) and update the tests that expect `building`/`planned` (the waitlist tests go with the waitlist section).

## 4. Deploy: its own Cloud Run service
- `Dockerfile` at repo root: build (`pnpm bundle && pnpm --filter @lens/trainer build`) then serve `apps/trainer/dist` with nginx on `$PORT` (8080), SPA fallback to `index.html`, long cache for hashed assets, no cache for `index.html`.
- `docs/deploy-cloud-run.md`: the exact commands Brian runs in **the 視点レンズ GCP project only** (`gcloud run deploy lens-web --source . --region asia-northeast1 --allow-unauthenticated`), then the domain mapping for `lens.domo-ai.com` and the DNS record he adds. Nothing that names ナゼホリ's project or services.

## 5. Tests
- Landing: every section renders; three course cards from `bundle.passes`, each button links to its Shopify URL; no 準備中.
- Access: right key unlocks only its Pass; wrong key does not; preview still works; storage failure still unlocks for the session.
- Headless iPad 1180×820 and phone 390×844, 0 console errors; the Docker image builds and serves `/`, `/check` and a deep link (`/lesson/koukou_juken/area`).

## Done when
lens.domo-ai.com's landing page sells all three courses, an access link opens exactly its course, and the container runs locally with `docker run -p 8080:8080`.
