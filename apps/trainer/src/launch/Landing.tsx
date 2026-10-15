// WO-024: the 視点レンズ landing page at /. Sections in the ナゼホリ landing page's order (header, hero,
// navy band, 8 lenses, one lesson, courses, parents, safety, access, FAQ, footer); one column of white
// cards on the Lens tokens. Copy from launch/copy.ts; the trap/lens times, lenses and course numbers
// from the bundle; prices and terms from the Architect's copy; Shopify links from launch.config.ts.
import { color, getCard, LensIcon, lensColor, loadBundle, themed, tokens, type LensOrDirect, type Pass } from '@lens/scenes';
import { Fragment, useEffect } from 'react';
import { t } from '../i18n/ja';
import { LAUNCH } from '../launch.config';
import { FOOTER, LANDING, PRIVACY, PROPOSED } from './copy';
import { preorderHref } from './tracking';

/** The navy band (the course player's dark theme), as CSS variables: no colour literals here. */
const dark = themed(tokens, 'short_dark').tokens;
const BAND = { ['--band-bg' as string]: color(dark.color.paper), ['--band-ink' as string]: color(dark.color.ink), ['--band-quiet' as string]: color(dark.color.ink_quiet) };

/** 「約4分」, 「約30秒」 from a card's time_cost_sec (whole minutes from a minute up). */
export function aboutTime(sec: number): string {
  return sec >= 60 ? `約${Math.round(sec / 60)}分` : `約${sec}秒`;
}

/** The card the navy band quotes: chugaku_juken's enclose masterclass example 1. */
export function roadsCard() {
  const pass = loadBundle().passes?.find((p) => p.id === 'chugaku_juken');
  const id = pass?.lessons.find((l) => l.lens === 'enclose')?.masterclass?.example1;
  return id ? getCard(id) : undefined;
}

/** A Pass's size on its card: lessons and problems (anchor cards), from bundle.passes. */
export const passSize = (p: Pass) => ({ lessons: p.lessons.length, problems: p.lessons.reduce((n, l) => n + l.cards.length, 0) });

export function Landing() {
  const bundle = loadBundle();
  const lenses = Object.entries(bundle.labels.lenses).filter(([id]) => id !== 'direct');
  const roads = roadsCard();
  return (
    <main className="launch lp">
      <header className="lp-header">
        <span className="logo">{LANDING.logo}</span>
        <a href="#access" className="owned">
          {LANDING.owned}
        </a>
      </header>

      <section className="lp-hero">
        <h1>
          {LANDING.h1[0]}
          <wbr />
          <mark>{LANDING.h1[1]}</mark>
          {LANDING.h1[2]}
        </h1>
        <p className="sub">{LANDING.sub}</p>
        <p className="lead">{LANDING.lead}</p>
        <div className="ctas">
          <a className="primary" href="#courses">
            {LANDING.choose}
          </a>
          <a className="secondary" href="/check">
            {LANDING.check}
          </a>
        </div>
      </section>

      {roads && (
        <section className="lp-band" style={BAND} data-card={roads.id}>
          <h2>{LANDING.twoRoads}</h2>
          <p className="road trap">{LANDING.trapRoad(aboutTime(roads.trap_route.time_cost_sec))}</p>
          <p className="road lens">{LANDING.lensRoad(aboutTime(roads.lens_route.time_cost_sec))}</p>
          <p className="point">{LANDING.roadsPoint}</p>
        </section>
      )}

      <section className="lp-section">
        <h2>{LANDING.lenses}</h2>
        <ul className="lp-lenses">
          {lenses.map(([id, label]) => (
            <li key={id} className="lp-card" data-lens={id}>
              <svg viewBox="0 0 24 24" width={32} height={32} aria-hidden>
                <LensIcon lens={id as LensOrDirect} tokens={tokens} color={lensColor(tokens, id as LensOrDirect)} />
              </svg>
              <strong>{label.ja}</strong>
              <span>{label.hint_ja}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-section">
        <h2>{LANDING.lesson}</h2>
        <ol className="lp-steps">
          {LANDING.lessonSteps.map(([title, body], i) => (
            <li key={title} className="lp-card">
              <span className="num">{'①②③'[i]}</span>
              <strong>{title}</strong>
              <span>{body}</span>
            </li>
          ))}
        </ol>
      </section>

      <Courses />

      <section className="lp-section">
        <h2>{LANDING.parents}</h2>
        <div className="lp-card lp-text">
          {LANDING.parentsLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>{LANDING.safety}</h2>
        <ul className="lp-card lp-checks">
          {LANDING.safetyLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="lp-section" id="access">
        <h2>{LANDING.access}</h2>
        <div className="lp-card lp-text">
          <p>{LANDING.accessLine}</p>
        </div>
      </section>

      <section className="lp-section">
        <h2>{LANDING.faq}</h2>
        <div className="lp-faq">
          {LANDING.faqs.map(([q, a]) => (
            <details key={q} className="lp-card">
              <summary>{q}</summary>
              <p>
                {a.split('特商法ページ').map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && <a href={LAUNCH.tokushohoUrl}>特商法ページ</a>}
                    {part}
                  </Fragment>
                ))}
              </p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}

/** The three courses, one card per Pass in bundle.passes, each with its Shopify product. */
export function Courses() {
  const passes = (loadBundle().passes ?? []).filter((p) => LAUNCH.passes[p.id]);
  return (
    <section className="lp-section" id="courses">
      <h2>{LANDING.courses}</h2>
      <div className="lp-courses">
        {passes.map((p) => {
          const size = passSize(p);
          return (
            <article key={p.id} className="lp-card lp-course" data-pass={p.id}>
              <span className="badge">{LANDING.badge}</span>
              <h3>{p.title_ja}</h3>
              {p.audience_ja && <p className="audience">{p.audience_ja}</p>}
              <p className="size">{LANDING.size(size.lessons, size.problems)}</p>
              <p className="price">
                <strong>{LANDING.founder}</strong>
              </p>
              <p className="list">{LANDING.list}</p>
              <p className="term">{LANDING.term}</p>
              <a className="primary" href={LAUNCH.passes[p.id]!.shopUrl}>
                {LANDING.buy}
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <a href={LAUNCH.tokushohoUrl}>{FOOTER.tokushoho}</a>
      <span aria-hidden>・</span>
      <a href={`mailto:${LAUNCH.supportEmail}`}>{FOOTER.contact}</a>
      <span aria-hidden>・</span>
      <a href={LAUNCH.companyUrl}>{FOOTER.company}</a>
      <span aria-hidden>・</span>
      <a href="/privacy">{FOOTER.privacy}</a>
      <span aria-hidden>・</span>
      {/* WO-022: required by VOICEVOX's terms. */}
      <span className="credit">{t('voice.credit')}</span>
    </footer>
  );
}

export function Privacy() {
  return (
    <main className="launch privacy">
      <h1>{FOOTER.privacy}</h1>
      <ul>
        {PRIVACY.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Footer />
    </main>
  );
}

/** After a signup: the confirmation line and the courses (this path counts the signup). */
export function Thanks() {
  return (
    <main className="launch lp">
      <p className="sent">{PROPOSED.signupSent}</p>
      <Courses />
      <Footer />
    </main>
  );
}

/**
 * /go/preorder (links in older Shorts): counts the click, then forwards to the 中学受験パス product with
 * the Short as UTM parameters. The link is there too, in case the forward is blocked.
 */
export function GoPreorder({ short }: { short: string | null }) {
  const href = preorderHref(LAUNCH.passes.chugaku_juken!.shopUrl, short);
  useEffect(() => {
    // A short pause lets the analytics beacon send before the page changes.
    const id = window.setTimeout(() => window.location.replace(href), 300);
    return () => window.clearTimeout(id);
  }, [href]);
  return (
    <main className="launch">
      <a className="primary" href={href}>
        {LANDING.buy}
      </a>
    </main>
  );
}
