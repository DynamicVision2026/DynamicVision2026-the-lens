// Launch settings (WO-009), filled in by the founder. Nothing else in the app holds these values.
export const LAUNCH = {
  siteUrl: '', // public site origin, e.g. https://lens.example.jp (X share link); empty = this page's origin
  shopDomain: 'TODO.myshopify.com', // Shopify store (customer signup form posts here)
  preorderUrl: 'https://TODO/products/…', // ¥6,800 preorder product
  tokushohoUrl: 'https://TODO/policies/legal-notice', // 特定商取引法 page on the store
  cfAnalyticsToken: '', // Cloudflare Web Analytics; empty = no script
  lessonsPublic: false, // WO-010: lessons stay locked (preview with ?preview=1) until launch
  passId: 'chugaku_juken', // the Pass the landing page sells (prices and seats from bundle.passes)
  founderSeatsLeft: null as number | null, // founder updates as orders come in; null hides the line
};
