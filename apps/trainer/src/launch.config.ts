// Launch settings (WO-009), filled in by the founder. Nothing else in the app holds these values.
export const LAUNCH = {
  siteUrl: 'https://domo-ai.com', // public site origin (Brian, Oct 13): free check at /check, X referrals at /check?s=x
  shopDomain: 'soul-id-2.myshopify.com', // Shopify store (customer signup form posts here)
  preorderUrl: 'https://soul-id-2.myshopify.com/products/lens-chugaku', // ¥6,800 preorder product (SKU LENS-CJ-12M, 30 founder seats)
  tokushohoUrl: 'https://soul-id-2.myshopify.com/policies/legal-notice', // 特定商取引法 page on the store
  cfAnalyticsToken: '', // Cloudflare Web Analytics; empty = no script
  lessonsPublic: false, // WO-010: lessons stay locked (preview with ?preview=1) until launch
  passId: 'chugaku_juken', // the Pass the landing page sells (prices and seats from bundle.passes)
  founderSeatsLeft: null as number | null, // founder updates as orders come in; null hides the line
};
