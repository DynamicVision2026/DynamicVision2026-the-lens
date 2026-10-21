# Plans: free + 1-year pass (¥5,800)

| | Free | 1-year pass (年間プラン) |
|---|---|---|
| Price | ¥0 | ¥5,800 (tax included), one payment, no auto-renewal |
| Photos | 30 per device in total, once (a trial: no monthly reset) | 200 a month per pass, shared by its 3 devices (resets on the 1st, 00:00 JST) |
| Devices | each device counts on its own | up to 3 devices of one family share one code |
| How | nothing to do | Shopify order number + email, or a handed-out code |

No accounts, no personal data: a device is a random id signed by the server; a pass is a code
(`LS-XXXX-XXXX-XXXX`). A Shopify order is stored only as its id, expiry and a keyed hash of the email.
Files live in the bucket next to the waitlist (`gs://<project>-lens-snap-waitlist/plans/`).

## Founder setup (once)

### 1. The product on Shopify (soul-id-2.myshopify.com)
- 商品管理 → 商品を追加. Title 「Lens Snap 年間プラン（1年間）」, price **5,800**, vendor **Lens Snap**.
- Variant **SKU `LENS-SNAP-1Y`**. 在庫を追跡 off. 「配送が必要な商品です」 off.
- URL handle: Shopify made **`つまずきマップ-年間プラン-1年間`** from the title; the app's buy button opens
  that address (percent-encoded in `BUY_URL`). If the handle is changed later, keep Shopify's redirect ticked.
- Settings → 税金: prices include tax (総額表示), so ¥5,800 is what parents pay.
- The course, if sold on the same store: give its variant SKU **`LENS-COURSE`**; its buyers unlock the same way.

### 2. Read-only access for the order check (Dev Dashboard app, 2026+)
- 設定 → アプリと販売チャネル → アプリを開発 → Dev Dashboard (or dev.shopify.com/dashboard) → アプリを作成, name 「Lens Snap order check」.
- Version: access scope **`read_orders`** only → release. Distribution: カスタム配信 → store `soul-id-2.myshopify.com` → install on the store.
- Settings: copy **Client ID** and **Client secret**. Then in Cloud Shell:
  `cd ~/DynamicVision2026-the-lens && git pull && bash apps/snap/deploy.sh shiten-lens-511712 --set-shopify`
  (paste the ID, then the secret; hidden). A legacy custom app's `shpat_` token also works (paste it as the ID, empty secret).
- The server exchanges ID + secret for a 24-hour token by itself and renews it.

Until step 2 is done, 「購入済みの方」 says 「いま確認できません」; codes work regardless.

### Codes (course sold elsewhere, gifts, pilot families)
`bash apps/snap/make-codes.sh shiten-lens-511712 20 "course Nov"` — prints 20 codes, puts them live, keeps
`~/lens-snap-codes.csv`. A code's year starts when it is first entered.

## Settings (env, all optional)
`FREE_TRIAL` (30) · `PASS_MONTHLY` (200) · `BUY_URL` · `PASS_SKUS` (`LENS-SNAP-1Y,LENS-COURSE`) · `SHOPIFY_STORE`
(`soul-id-2.myshopify.com`) · `SHOPIFY_API_VERSION` (`2026-07`) · `PLAN_DIR` · `SIGNING_KEY` (else made once in the plan folder).

## Tested
`test/plans.test.ts` (quota, JST month reset, codes, 3-device limit, expiry, order claim, Shopify checks,
token exchange) and the walkthrough's plan steps on 3 devices with a stand-in Shopify.
Not tested here: the real Shopify store (needs the founder's access).
