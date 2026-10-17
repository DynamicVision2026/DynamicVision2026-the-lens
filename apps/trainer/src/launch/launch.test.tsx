import { loadBundle, tokens } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LAUNCH } from '../launch.config';
import { LANDING, PRIVACY, SIGNUP } from './copy';
import { aboutTime, freeLenses, Landing, LENS_ORDER, passSize, Privacy, roadsCard } from './Landing';
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

describe('landing page (WO-024, approved Lens.dc.html artboard)', () => {
  const html = renderToStaticMarkup(<Landing />);
  const text = html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  const passes = loadBundle().passes!;
  const lensColor = (id: string) => (tokens.color.lens as unknown as Record<string, { value: string }>)[id]!.value;

  it('renders every artboard section in order, with its copy', () => {
    const order = [LANDING.logo, LANDING.nav.owned, LANDING.eyebrow, LANDING.h1.join(''), LANDING.sub, LANDING.lead, LANDING.tryFree, LANDING.heroNote, LANDING.what.title, LANDING.what.note, LANDING.twoRoads, LANDING.roadsLead, LANDING.roadsPoint, LANDING.trialHow, LANDING.lenses, LANDING.freeNote, LANDING.lesson, LANDING.courses, LANDING.parents, LANDING.safety, LANDING.access, LANDING.faq, LANDING.operator];
    let at = -1;
    for (const line of order) {
      const k = text.indexOf(line, at + 1);
      expect(k, line).toBeGreaterThan(at);
      at = k;
    }
    for (const line of [...LANDING.trialSteps.flat(), ...LANDING.lessonSteps.flat(), LANDING.lessonNote, LANDING.parentsBody, LANDING.parentsNote, ...LANDING.safetyLines, LANDING.accessLine, LANDING.accessHelp('info@domo-ai.com'), ...LANDING.faqs.flat(), LANDING.voice])
      expect(text, line).toContain(line);
    expect(html).toContain(`<mark>${LANDING.h1[1]}</mark>`);
    for (const id of ['courses', 'trial', 'access', 'faq']) expect(html).toContain(`id="${id}"`);
  });

  it('takes every colour and the font from tokens.json', () => {
    const L = tokens.color.landing!;
    for (const key of ['ground', 'navy', 'navy_soft', 'text', 'muted', 'on_navy', 'line', 'accent', 'trap_time'] as const) expect(html, key).toContain(L[key].value);
    expect(html).toContain(tokens.type.family_landing!);
    // 8 lens chips in the hero and 8 tinted lens cards, each in its lens colour.
    const chips = [...html.matchAll(/<ul class="lp2-chips"[^>]*>([\s\S]*?)<\/ul>/g)][0]![1]!;
    expect((chips.match(/<li /g) ?? []).length).toBe(8);
    for (const id of LENS_ORDER) {
      expect(chips).toContain(`--c:${lensColor(id)}`);
      expect(html).toMatch(new RegExp(`data-lens="${id}" style="--c:${lensColor(id)}"`));
    }
  });

  it('quotes chugaku_juken enclose example 1\'s trap and lens times from the bundle', () => {
    const card = roadsCard()!;
    const pass = passes.find((p) => p.id === 'chugaku_juken')!;
    expect(card.id).toBe(pass.lessons.find((l) => l.lens === 'enclose')!.masterclass!.example1);
    const band = /<section class="lp2-band"[\s\S]*?<\/section>/.exec(html)![0];
    expect(band).toContain(aboutTime(card.trap_route.time_cost_sec));
    expect(band).toContain(aboutTime(card.lens_route.time_cost_sec));
    expect(aboutTime(240)).toBe('約4分');
    expect(aboutTime(30)).toBe('約30秒');
  });

  it('marks the lenses the free trial opens: each Pass\'s first lesson', () => {
    expect([...freeLenses()].sort()).toEqual([...new Set(passes.map((p) => p.lessons[0]!.lens))].sort());
    const cards = html.split('class="lp2-lens"').slice(1);
    const badged = cards.filter((c) => c.split('</li>')[0]!.includes(LANDING.freeBadge)).map((c) => /data-lens="(\w+)"/.exec(c)![1]);
    expect(badged.sort()).toEqual([...freeLenses()].sort());
  });

  it('sells all three courses: band, numbers from the bundle, buy in its lens colour, and the 3-day trial', () => {
    const cards = [...html.matchAll(/<article class="lp2-course" data-pass="(\w+)" style="([^"]*)">([\s\S]*?)<\/article>/g)];
    expect(cards.map((m) => m[1])).toEqual(passes.map((p) => p.id));
    const buyLens: Record<string, string> = { chugaku_juken: 'enclose', koukou_juken: 'slide', daigaku_juken: 'balance' };
    for (const [, id, style, body] of cards) {
      const p = passes.find((x) => x.id === id)!;
      const size = passSize(p);
      expect(style).toContain(tokens.color.landing![`band_${id!.split('_')[0]}` as 'band_chugaku'].value);
      expect(style).toContain(`--c:${lensColor(buyLens[id!]!)}`);
      expect(body).toContain(p.title_ja);
      expect(body).toContain(LANDING.content(size.lessons, size.problems));
      expect(body).toContain(LANDING.free(loadBundle().labels.lenses[p.lessons[0]!.lens]!.ja));
      for (const line of [LANDING.course[id!]!.audience, LANDING.course[id!]!.blurb, LANDING.term, LANDING.price, LANDING.priceNote, LANDING.list, LANDING.buy, LANDING.trial]) expect(body, line).toContain(line);
      expect(body).toContain(`href="${LAUNCH.passes[id!]!.shopUrl}"`);
      expect(body).toContain(`href="/trial/${id}"`);
    }
  });

  it('has no waitlist, 準備中 or preorder left, and no hex colour typed in the copy', () => {
    for (const banned of ['準備中', '先行登録', '先行予約', 'waitlist', '/go/preorder']) expect(html, banned).not.toContain(banned);
  });

  it('links the footer: 特商法, contact, company, privacy, the domo-ai.com cover page', () => {
    expect(html).toContain(`href="${LAUNCH.tokushohoUrl}"`);
    expect(html).toContain('href="mailto:info@domo-ai.com"');
    expect(html).toContain('href="https://beyondculture.ai"');
    expect(html).toContain('href="https://domo-ai.com"');
    expect(text).toContain('VOICEVOX:春日部つむぎ');
    expect(LAUNCH.siteUrl).toBe('https://lens.domo-ai.com');
  });

  it('renders the privacy note', () => {
    const html = renderToStaticMarkup(<Privacy />);
    for (const line of PRIVACY) expect(html).toContain(line);
  });
});
