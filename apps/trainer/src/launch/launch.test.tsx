import { loadBundle } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LAUNCH } from '../launch.config';
import { FOOTER, LANDING, PRIVACY, SIGNUP } from './copy';
import { aboutTime, Landing, passSize, Privacy, roadsCard } from './Landing';
import { Signup } from './Signup';
import { t } from '../i18n/ja';
import { beaconConfig, checkTags, preorderHref, shortFrom, signupAction, signupTags, xShareHref } from './tracking';

describe('Short tracking', () => {
  it('reads ?s=<card-id> and ignores anything else', () => {
    expect(shortFrom('?s=enclose-001')).toBe('enclose-001');
    expect(shortFrom('?x=1&s=mirror-001')).toBe('mirror-001');
    expect(shortFrom('')).toBeNull();
    expect(shortFrom('?s=')).toBeNull();
    expect(shortFrom('?s=<script>')).toBeNull();
    expect(shortFrom('?s=a,b')).toBeNull();
  });

  it('tags the signup with free-lens and the Short', () => {
    expect(signupTags('enclose-001')).toBe('free-lens,enclose-001');
    expect(signupTags(null)).toBe('free-lens');
  });

  it('adds the Short to the preorder link as UTM parameters', () => {
    expect(preorderHref('https://shop.example/products/lens', 'enclose-001')).toBe('https://shop.example/products/lens?utm_source=short&utm_content=enclose-001');
    expect(preorderHref('https://shop.example/products/lens?variant=1', 'enclose-001')).toBe('https://shop.example/products/lens?variant=1&utm_source=short&utm_content=enclose-001');
    expect(preorderHref('https://shop.example/products/lens', null)).toBe('https://shop.example/products/lens');
  });

  it('loads analytics only with a token', () => {
    expect(beaconConfig('')).toBeNull();
    expect(JSON.parse(beaconConfig('abc')!)).toEqual({ token: 'abc', spa: true });
  });
});

describe('check result touchpoints (WO-013)', () => {
  it('tags the check signup with free-check, the top confusion pair and the Short', () => {
    expect(checkTags(['area', 'balance', 2], null)).toBe('free-check,confused:area-balance');
    expect(checkTags(['area', 'balance', 1], 'x')).toBe('free-check,confused:area-balance,x');
    expect(checkTags(undefined, null)).toBe('free-check');
  });

  it('builds the X Web Intent with the WO text and /check?s=x', () => {
    const text = t('check.shareText', { score: 6, sec: '4.2' });
    expect(text).toBe('どのレンズ？チェック 6/8問・1問平均4.2秒でした。#中学受験 #2027年組');
    const u = new URL(xShareHref(text, 'https://lens.example/'));
    expect(u.origin + u.pathname).toBe('https://x.com/intent/post');
    expect(u.searchParams.get('text')).toBe(text);
    expect(u.searchParams.get('url')).toBe('https://lens.example/check?s=x');
    expect(shortFrom('?s=x')).toBe('x');
  });

  it('renders the check email form with its own title and tags', () => {
    const html = renderToStaticMarkup(<Signup short={null} title={t('check.emailTitle')} tags={checkTags(['area', 'balance', 1], null)} stay />);
    expect(html).toContain('診断結果と『4週間完成スケジュール（PDF）』をメールで受け取る');
    expect(html).toContain('value="free-check,confused:area-balance"');
    expect(html).toContain(SIGNUP.consent);
    expect(html).not.toContain('LINE');
  });
});

describe('signup form', () => {
  const html = renderToStaticMarkup(<Signup short="enclose-001" />);

  it("posts to the store's customer form with the WO-009 fields", () => {
    expect(html).toContain('method="post"');
    expect(html).toContain(`action="${signupAction(LAUNCH.shopDomain)}"`);
    expect(signupAction('test.myshopify.com')).toBe('https://test.myshopify.com/contact#contact_form');
    expect(html).toContain('name="form_type" value="customer"');
    expect(html).toContain('name="utf8" value="✓"');
    expect(html).toContain('name="contact[tags]" value="free-lens,enclose-001"');
    expect(html).toContain('name="contact[accepts_marketing]" value="true"');
    const email = /<input type="email"[^>]*>/.exec(html)?.[0] ?? '';
    expect(email).toContain('name="contact[email]"');
    expect(email).toContain('required=""');
    expect(html.match(/<input/g)).toHaveLength(5);
  });

  it('shows the title and the consent line as written', () => {
    expect(html).toContain(SIGNUP.title);
    expect(html).toContain(SIGNUP.consent);
  });
});

describe('landing page (WO-024)', () => {
  const html = renderToStaticMarkup(<Landing />);
  const text = html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  const passes = loadBundle().passes!;

  it('renders every section in the WO order, with the Architect\'s copy', () => {
    const order = [LANDING.logo, LANDING.owned, LANDING.h1.join(''), LANDING.sub, LANDING.lead, LANDING.twoRoads, LANDING.roadsPoint, LANDING.lenses, LANDING.lesson, LANDING.courses, LANDING.parents, LANDING.safety, LANDING.access, LANDING.faq, FOOTER.tokushoho];
    let at = -1;
    for (const line of order) {
      const k = text.indexOf(line, at + 1);
      expect(k, line).toBeGreaterThan(at);
      at = k;
    }
    for (const line of [...LANDING.parentsLines, ...LANDING.safetyLines, LANDING.accessLine, ...LANDING.lessonSteps.flat(), ...LANDING.faqs.flat().map((s) => s.replace('特商法ページ', ''))]) expect(text).toContain(line);
    expect(html).toContain(`<mark>${LANDING.h1[1]}</mark>`);
    expect(html).toContain('href="#courses"');
    expect(html).toContain('href="/check"');
    expect(html).toContain('href="#access"');
    expect(html).toContain('id="access"');
  });

  it('quotes the trap and lens times of chugaku_juken enclose example 1 from the bundle', () => {
    const card = roadsCard()!;
    const pass = passes.find((p) => p.id === 'chugaku_juken')!;
    expect(card.id).toBe(pass.lessons.find((l) => l.lens === 'enclose')!.masterclass!.example1);
    expect(text).toContain(LANDING.trapRoad(aboutTime(card.trap_route.time_cost_sec)));
    expect(text).toContain(LANDING.lensRoad(aboutTime(card.lens_route.time_cost_sec)));
    expect(aboutTime(240)).toBe('約4分');
    expect(aboutTime(30)).toBe('約30秒');
  });

  it('shows the 8 lenses from labels (not the direct move)', () => {
    const lenses = loadBundle().labels.lenses;
    const ids = [...html.matchAll(/data-lens="(\w+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(8);
    expect(ids).not.toContain('direct');
    for (const id of ids) expect(text).toContain(lenses[id!]!.hint_ja);
  });

  it('sells all three courses, each button going to its own Shopify product', () => {
    expect(passes.map((p) => p.id).sort()).toEqual(['chugaku_juken', 'daigaku_juken', 'koukou_juken']);
    const cards = [...html.matchAll(/<article class="lp-card lp-course" data-pass="(\w+)">([\s\S]*?)<\/article>/g)];
    expect(cards.map((m) => m[1])).toEqual(passes.map((p) => p.id));
    for (const [, id, body] of cards) {
      const p = passes.find((x) => x.id === id)!;
      const size = passSize(p);
      expect(body).toContain(p.title_ja);
      expect(body).toContain(p.audience_ja!);
      expect(body).toContain(LANDING.size(size.lessons, size.problems));
      for (const line of [LANDING.founder, LANDING.list, LANDING.term, LANDING.badge, LANDING.buy]) expect(body).toContain(line);
      expect(body).toContain(`href="${LAUNCH.passes[id!]!.shopUrl}"`);
    }
    expect(new Set(Object.values(LAUNCH.passes).map((p) => p.shopUrl)).size).toBe(3);
  });

  it('has no waitlist, 準備中 or preorder left', () => {
    for (const banned of ['準備中', '先行登録', '先行予約', 'waitlist', '/go/preorder']) expect(html, banned).not.toContain(banned);
  });

  it('links the footer: 特商法, contact, company, VOICEVOX credit', () => {
    expect(html).toContain(`href="${LAUNCH.tokushohoUrl}"`);
    expect(html).toContain('href="mailto:info@domo-ai.com"');
    expect(html).toContain('href="https://beyondculture.ai"');
    expect(text).toContain(t('voice.credit'));
    expect(LAUNCH.siteUrl).toBe('https://lens.domo-ai.com');
  });

  it('renders the privacy note', () => {
    const html = renderToStaticMarkup(<Privacy />);
    for (const line of PRIVACY) expect(html).toContain(line);
  });
});
