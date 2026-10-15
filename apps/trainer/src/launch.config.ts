// Launch settings (WO-009, WO-024), filled in by the founder. Nothing else in the app holds these values.
export const LAUNCH = {
  siteUrl: 'https://lens.domo-ai.com', // WO-024: 視点レンズ's own Cloud Run service (free check at /check, X referrals at /check?s=x)
  shopDomain: 'soul-id-2.myshopify.com', // Shopify store (customer signup form posts here)
  tokushohoUrl: 'https://soul-id-2.myshopify.com/policies/legal-notice', // 特定商取引法 page on the store
  supportEmail: 'info@domo-ai.com', // お問い合わせ (footer, wrong access link)
  companyUrl: 'https://beyondculture.ai', // 運営会社
  coverUrl: 'https://domo-ai.com', // the cover page with both products (footer 「domo-ai.com トップへ」)
  cfAnalyticsToken: '', // Cloudflare Web Analytics; empty = no script
  ga4Id: '', // WO-025: 視点レンズ's own GA4 property (G-XXXXXXXXXX); empty = no script, no events
  lessonsPublic: false, // WO-024: kept for the free /check only; lessons open per Pass (access links) or with ?preview=1
  /**
   * WO-024: each Pass's Shopify product and its access key. The order email links to
   * /open?p=<pass>&k=<key>, which unlocks that Pass on the device (a soft lock: no server, no account).
   */
  passes: {
    chugaku_juken: { shopUrl: 'https://soul-id-2.myshopify.com/products/lens-chugaku', key: 'HS771AmBoRnfQt7-' },
    koukou_juken: { shopUrl: 'https://soul-id-2.myshopify.com/products/lens-koukou', key: 'C8mpgQUwhXpwKWxm' },
    daigaku_juken: { shopUrl: 'https://soul-id-2.myshopify.com/products/lens-daigaku', key: 'frymep1_SqyTFzZo' },
  } as Record<string, { shopUrl: string; key: string }>,
  founderSeatsLeft: null as number | null, // founder updates as orders come in; null hides the line
};
