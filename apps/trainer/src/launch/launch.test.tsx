import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LAUNCH } from '../launch.config';
import { FOOTER, LANDING, PREORDER, PRIVACY, SIGNUP } from './copy';
import { Landing, Privacy } from './Landing';
import { Signup } from './Signup';
import { beaconConfig, preorderHref, shortFrom, signupAction, signupTags } from './tracking';

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

describe('landing and privacy copy', () => {
  it('renders every WO-009 line on the landing page', () => {
    const html = renderToStaticMarkup(<Landing short={null} />).replace(/<wbr\/>/g, '');
    for (const line of [LANDING.eyebrow, LANDING.h1, LANDING.heroCaption, LANDING.start, ...LANDING.points, PREORDER.title, PREORDER.earlyPrice, PREORDER.delivery, PREORDER.button, FOOTER.privacy, FOOTER.tokushoho]) {
      expect(html).toContain(line.replace(/"/g, '&quot;'));
    }
    expect(html).toContain(LANDING.sub.replace(/"/g, '&quot;'));
    expect(html).toContain('href="/play/enclose-001"');
    expect(html).toContain(`href="${LAUNCH.tokushohoUrl}"`);
    expect(html).toContain('<svg'); // the enclose-001 hero
  });

  it("doesn't give away the Free Lens answer in the hero", () => {
    const html = renderToStaticMarkup(<Landing short={null} />);
    expect(html).not.toContain('19.5');
  });

  it('breaks the H1 only after 「、」 and 「を」, keeping 「選ぶ。」 together', () => {
    const html = renderToStaticMarkup(<Landing short={null} />);
    const h1 = /<h1>(.*?)<\/h1>/.exec(html)![1]!;
    expect(h1.split('<wbr/>')).toEqual(['計算する前に、', '「見方」を', '選ぶ。']);
  });

  it('renders the privacy note', () => {
    const html = renderToStaticMarkup(<Privacy />);
    for (const line of PRIVACY) expect(html).toContain(line);
  });
});
