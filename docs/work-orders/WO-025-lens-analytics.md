# WO-025: 視点レンズ operations data (Google Analytics 4), ships after launch

**Owner:** Builder · **Review:** Architect · **Why (Brian, Oct 15):** "how many people click our landing page and my course, who paid, who didn't, how long they used the course: the status of the whole operation."

## Rules
- **Isolation:** its own GA4 property 「視点レンズ」 in Brian's Google Analytics account. Never ナゼホリ's property, tag or data.
- **No personal data in GA:** never send names, emails or what a child types. A paid customer is identified only by the Shopify **order number** (`#1234`) from the email link; Brian looks the name up in Shopify.
- **Off until configured:** `launch.config.ts` gets `ga4Id: ''`. Empty means no script is loaded and no event is sent, so this PR can merge and deploy before Brian has the ID.
- GA config: `allow_google_signals: false`, `allow_ad_personalization_signals: false`. No ads features.

## Events (gtag, only when `ga4Id` is set)
| event | when | params |
|---|---|---|
| `page_view` | every route change (SPA) | `page_path` |
| `select_course` | 「このコースを買う」 click | `pass` |
| `trial_start` | trial started (§3a of WO-024) | `pass` |
| `course_open` | `/open` with a valid key | `pass`, `order` (the `o` parameter, if present); also `gtag('set', {user_id: order})` and remember the order in `lens.v1.order.<passId>` so later sessions on the device keep the same `user_id` |
| `lesson_open` | a lesson's masterclass or practice opens | `pass`, `lesson`, `mode` = `paid` / `trial` / `preview` |
| `lesson_complete` | the practice's last problem is answered | `pass`, `lesson` |
| `check_complete` | the free 3-minute check finishes | none |
Usage time comes from GA4's own engagement time (per `user_id` for paid customers, per device for trials).

## Access link
`/open` accepts an optional `o=<order number>` and ignores it if missing (old links keep working). The Architect adds `&o={{ order_name | url_encode }}` to the Shopify email after this ships.

## Disclosure (電気通信事業法 外部送信規律)
Footer link 「外部送信について」 → a short page: Google Analytics (Google LLC), what is sent (pages viewed, buttons pressed, usage time, order number for purchasers), purpose (improving the course), no advertising use, how to opt out (Google's opt-out add-on). Copy in `launch/copy.ts`.

## Tests
With `ga4Id: ''`: no gtag script in the DOM, no network call. With a test ID: each event above fires once with the right params (mock `window.gtag`). `/open` with and without `o`.

## Done when
Setting `ga4Id` and redeploying makes visits, course clicks, trials, course opens (by order number), lessons and usage time appear in GA4 Realtime.
