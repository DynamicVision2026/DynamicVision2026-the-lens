// WO-024: the 視点レンズ landing page at /, built from the approved Lens.dc.html artboard (Brian, Oct 15) at
// full colour: header, hero with the 8 lens chips, the navy two-roads band, 無料体験のしくみ, the 8 lenses
// (tinted in their colours), one lesson, the three courses (band per course, buy button in its lens colour,
// 3-day trial), parents and safety, purchased, FAQ, footer. Copy from launch/copy.ts; every colour and the
// font from tokens.json (color.landing, lens colours, type.family_landing); sizes, times and the free
// lenses from the bundle; Shopify links from launch.config.ts.
import { color, getCard, loadBundle, tokens, type LensId, type Pass } from '@lens/scenes';
import { Fragment, useEffect, type CSSProperties } from 'react';
import { LAUNCH } from '../launch.config';
import { track } from './analytics';
import { BookLink, bookUrl, passBook } from './BookLink';
import { EXTERNAL, FOOTER, LANDING, PRIVACY, PROPOSED } from './copy';
import { preorderHref } from './tracking';

const L = tokens.color.landing!;
const lens = (id: string) => color(tokens.color.lens[id as LensId]);
const v = (vars: Record<string, string>) => vars as CSSProperties;

/** The page's palette as CSS variables (no colour literals in app source). */
export const PAGE_VARS = v({
  '--l-ground': color(L.ground),
  '--l-card': color(L.card),
  '--l-navy': color(L.navy),
  '--l-navy-soft': color(L.navy_soft),
  '--l-text': color(L.text),
  '--l-muted': color(L.muted),
  '--l-on-navy': color(L.on_navy),
  '--l-line': color(L.line),
  '--l-accent': color(L.accent),
  '--l-trap': color(L.trap_time),
  '--l-tint': `${Math.round(L.lens_tint_opacity * 100)}%`,
  '--l-font': `'${tokens.type.family_landing}', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif`,
});

/** The artboard's order of the 8 lenses (names and hints from labels/lenses.yaml). */
export const LENS_ORDER = ['enclose', 'slide', 'mirror', 'unfold', 'area', 'constant', 'balance', 'freeze'] as const;
/** Each course's colour: its band from color.landing, its buy button in a lens colour (blue, green, purple). */
const COURSE_STYLE: Record<string, { band: keyof typeof L; lens: LensId }> = {
  chugaku_juken: { band: 'band_chugaku', lens: 'enclose' },
  koukou_juken: { band: 'band_koukou', lens: 'slide' },
  daigaku_juken: { band: 'band_daigaku', lens: 'balance' },
};
/** 無料体験のしくみ steps 1–3 and the lesson flow's headings, in lens colours. */
const TRIAL_STEP_LENS: LensId[] = ['enclose', 'freeze', 'balance'];
/** 視点レンズは、何をするもの？ steps 1–3. */
const WHAT_STEP_LENS: LensId[] = ['slide', 'mirror', 'constant'];
const LESSON_STEP_LENS: LensId[] = ['enclose', 'slide', 'balance'];

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

/** The lenses some course's free trial opens (each Pass's first lesson). */
export function freeLenses(): Set<string> {
  return new Set<string>((loadBundle().passes ?? []).flatMap((p) => (p.lessons[0] ? [p.lessons[0].lens] : [])));
}

/** Zen Kaku Gothic New (type.family_landing), loaded on the landing page only. */
function useLandingFont() {
  useEffect(() => {
    const family = tokens.type.family_landing;
    if (!family || document.getElementById('lp-font')) return;
    const link = document.createElement('link');
    link.id = 'lp-font';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;500;700;900&display=swap`;
    document.head.appendChild(link);
  }, []);
}

function Logo() {
  return (
    <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden="true" className="lp-logo-mark">
      <circle cx={15} cy={15} r={11} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <path d="M23 23 L31 31" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <path d="M10 18 L15 10 L20 18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  );
}

export function Landing() {
  useLandingFont();
  const labels = loadBundle().labels.lenses;
  const roads = roadsCard();
  const free = freeLenses();
  return (
    <div className="lp2" style={PAGE_VARS}>
      <header className="lp2-wrap lp2-header">
        <a href="/" className="lp2-brand">
          <Logo />
          <span>{LANDING.logo}</span>
        </a>
        <nav className="lp2-nav">
          <a href="#courses">{LANDING.nav.courses}</a>
          {anyBookLive() && <a href="#books">{LANDING.nav.books}</a>}
          <a href="#faq">{LANDING.nav.faq}</a>
          <a href="#access" className="pill">
            {LANDING.nav.owned}
          </a>
        </nav>
      </header>

      <main>
        <section className="lp2-wrap lp2-hero">
          <p className="eyebrow">{LANDING.eyebrow}</p>
          <h1>
            {LANDING.h1[0]}
            <wbr />
            <mark>{LANDING.h1[1]}</mark>
            {LANDING.h1[2]}
          </h1>
          <p className="sub">{LANDING.sub}</p>
          <p className="lead">{LANDING.lead}</p>
          <ul className="lp2-chips" aria-label={LANDING.lenses}>
            {LENS_ORDER.map((id) => (
              <li key={id} style={v({ '--c': lens(id) })}>
                {labels[id]?.ja}
              </li>
            ))}
          </ul>
          <div className="ctas">
            <a className="lp2-btn solid" href="#courses">
              {LANDING.tryFree}
            </a>
            <a className="lp2-btn outline" href="#courses">
              {LANDING.seeCourses}
            </a>
          </div>
          <p className="note">{LANDING.heroNote}</p>
          {anyBookLive() && (
            <a className="lp2-news" href="#books">
              {LANDING.bookNews} →
            </a>
          )}
        </section>

        <section className="lp2-wrap lp2-section lp2-what" id="what">
          <h2>{LANDING.what.title}</h2>
          <ol className="lp2-steps">
            {LANDING.what.steps.map(([title, body], i) => (
              <li key={title} className="lp2-card topline" style={v({ '--c': lens(WHAT_STEP_LENS[i]!) })}>
                <span className="num">{i + 1}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <p className="note">{LANDING.what.note}</p>
        </section>

        {roads && (
          <section className="lp2-band" data-card={roads.id}>
            <div className="lp2-wrap">
              <h2>{LANDING.twoRoads}</h2>
              <p className="lead">{LANDING.roadsLead}</p>
              <div className="roads">
                <div className="road trap">
                  <div className="head">
                    <span className="label">{LANDING.trapRoad}</span>
                    <span className="time">{aboutTime(roads.trap_route.time_cost_sec)}</span>
                  </div>
                  <p>{LANDING.trapPath}</p>
                </div>
                <div className="road lens" style={v({ '--c': lens(roads.lens) })}>
                  <div className="head">
                    <span className="label">{LANDING.lensRoad(labels[roads.lens]?.ja ?? '')}</span>
                    <span className="time">{aboutTime(roads.lens_route.time_cost_sec)}</span>
                  </div>
                  <p>{LANDING.lensPath}</p>
                </div>
              </div>
              <p className="point">{LANDING.roadsPoint}</p>
            </div>
          </section>
        )}

        <section className="lp2-wrap lp2-section" id="trial">
          <h2>{LANDING.trialHow}</h2>
          <ol className="lp2-steps">
            {LANDING.trialSteps.map(([title, body], i) => (
              <li key={title} className="lp2-card topline" style={v({ '--c': lens(TRIAL_STEP_LENS[i]!) })}>
                <span className="num">{i + 1}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp2-wrap lp2-section">
          <h2>{LANDING.lenses}</h2>
          <p className="lead">{LANDING.lensesLead}</p>
          <ul className="lp2-lenses">
            {LENS_ORDER.map((id) => (
              <li key={id} className="lp2-lens" data-lens={id} style={v({ '--c': lens(id) })}>
                <div className="head">
                  <strong>{labels[id]?.ja}</strong>
                  {free.has(id) && <span className="free">{LANDING.freeBadge}</span>}
                </div>
                <span>{labels[id]?.hint_ja}</span>
              </li>
            ))}
          </ul>
          <p className="note">{LANDING.freeNote}</p>
        </section>

        <section className="lp2-wrap lp2-section">
          <div className="lp2-card big">
            <h2>{LANDING.lesson}</h2>
            <ol className="lp2-flow">
              {LANDING.lessonSteps.map(([title, body], i) => (
                <li key={title} style={v({ '--c': lens(LESSON_STEP_LENS[i]!) })}>
                  <strong>{title}</strong>：{body}
                </li>
              ))}
            </ol>
            <p className="note">{LANDING.lessonNote}</p>
          </div>
        </section>

        <Courses />

        <Books />

        <section className="lp2-wrap lp2-section lp2-pair">
          <div className="lp2-card big">
            <h2>{LANDING.parents}</h2>
            <p>{LANDING.parentsBody}</p>
            <p className="note">{LANDING.parentsNote}</p>
          </div>
          <div className="lp2-card big">
            <h2>{LANDING.safety}</h2>
            <ul className="lp2-list">
              {LANDING.safetyLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp2-wrap lp2-section" id="access">
          <div className="lp2-card big framed">
            <h2>{LANDING.access}</h2>
            <p>{LANDING.accessLine}</p>
            <p className="note">{LANDING.accessHelp(LAUNCH.supportEmail)}</p>
          </div>
        </section>

        <section className="lp2-wrap lp2-section last" id="faq">
          <h2>{LANDING.faq}</h2>
          <dl className="lp2-faq">
            {LANDING.faqs.map(([q, a]) => (
              <div key={q} className="lp2-card">
                <dt>{q}</dt>
                <dd>
                  {a.split('特定商取引法に基づく表記').map((part, i) => (
                    <Fragment key={i}>
                      {i > 0 && <a href={LAUNCH.tokushohoUrl}>特定商取引法に基づく表記</a>}
                      {part}
                    </Fragment>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/** The three courses, one card per Pass in bundle.passes: its band, its numbers, buy and the 3-day trial. */
export function Courses() {
  const bundle = loadBundle();
  const passes = (bundle.passes ?? []).filter((p) => LAUNCH.passes[p.id]);
  return (
    <section className="lp2-wrap lp2-section" id="courses" style={PAGE_VARS}>
      <div className="lp2-courses-head">
        <h2>{LANDING.courses}</h2>
        <span className="launch-badge">{LANDING.launch}</span>
      </div>
      <div className="lp2-courses">
        {passes.map((p) => {
          const size = passSize(p);
          const copy = LANDING.course[p.id];
          const style = COURSE_STYLE[p.id];
          const freeLens = p.lessons[0]?.lens ?? '';
          return (
            <article key={p.id} className="lp2-course" data-pass={p.id} style={v({ '--band': style ? color(L[style.band] as typeof L.ground) : color(L.accent), '--c': lens(style?.lens ?? 'enclose') })}>
              <div className="band">
                <span className="audience">{copy?.audience ?? p.audience_ja}</span>
                <h3>{p.title_ja}</h3>
              </div>
              <div className="body">
                {copy && <p className="blurb">{copy.blurb}</p>}
                <ul className="rows">
                  <li>
                    <span>{LANDING.rows.content}</span>
                    <span>{LANDING.content(size.lessons, size.problems)}</span>
                  </li>
                  <li>
                    <span>{LANDING.rows.term}</span>
                    <span>{LANDING.term}</span>
                  </li>
                  <li>
                    <span>{LANDING.rows.free}</span>
                    <span>{LANDING.free(bundle.labels.lenses[freeLens]?.ja ?? freeLens)}</span>
                  </li>
                </ul>
                <p className="price">
                  <strong>{LANDING.price}</strong>
                  <span>{LANDING.priceNote}</span>
                </p>
                <p className="list">{LANDING.list}</p>
                <div className="buttons">
                  <a className="lp2-btn buy" href={LAUNCH.passes[p.id]!.shopUrl} onClick={() => track({ name: 'select_course', params: { pass: p.id } })}>
                    {LANDING.buy}
                  </a>
                  <a className="lp2-btn outline" href={`/trial/${p.id}`}>
                    {LANDING.trial}
                  </a>
                </div>
                <BookLink passId={p.id} className="lp2-book" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** The passes that have a paperback, in course order. */
function bookPasses() {
  return (loadBundle().passes ?? []).filter((p) => LAUNCH.passes[p.id] && passBook(p.id)?.id);
}

/** True once at least one paperback is live on Amazon (status live + amazon_url). */
export function anyBookLive(): boolean {
  return bookPasses().some((p) => bookUrl(passBook(p.id)) !== null);
}

/** Oct 17: the Amazon paperbacks, one card per Pass; a live book links to Amazon, the others say 近日発売. Hidden until one is live. */
export function Books() {
  if (!anyBookLive()) return null;
  return (
    <section className="lp2-wrap lp2-section" id="books" style={PAGE_VARS}>
      <h2>{LANDING.books.title}</h2>
      <p className="lead">{LANDING.books.lead}</p>
      <div className="lp2-books">
        {bookPasses().map((p) => {
          const book = passBook(p.id)!;
          const url = bookUrl(book);
          const style = COURSE_STYLE[p.id];
          return (
            <article key={p.id} className="lp2-bookcard" data-book={book.id} style={v({ '--c': lens(style?.lens ?? 'enclose') })}>
              <img src={`/books/${book.id}.jpg`} alt={book.title_ja ?? ''} width={360} height={508} loading="lazy" />
              <div className="body">
                <span className="audience">{LANDING.course[p.id]?.audience ?? p.audience_ja}</span>
                <h3>{book.title_ja}</h3>
                <p className="sub">
                  {(book.subtitle_ja ?? '').split('　').map((part) => (
                    <span key={part}>{part}</span>
                  ))}
                </p>
                {book.price_jpy ? <p className="price">{LANDING.books.price(book.price_jpy)}</p> : null}
                {url ? (
                  <a className="lp2-btn solid" href={url} target="_blank" rel="noopener" onClick={() => track({ name: 'book_click', params: { pass: p.id } })}>
                    {LANDING.books.buy}
                  </a>
                ) : (
                  <span className="soon">{LANDING.books.soon}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="note">{LANDING.books.note}</p>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="lp2-footer" style={PAGE_VARS}>
      <div className="lp2-wrap">
        <span>
          {LANDING.operator}　・　{LANDING.voice}
        </span>
        <nav>
          <a href={LAUNCH.tokushohoUrl}>{FOOTER.tokushoho}</a>
          <a href={`mailto:${LAUNCH.supportEmail}`}>{FOOTER.contact}</a>
          <a href={LAUNCH.companyUrl}>{FOOTER.company}</a>
          <a href="/privacy">{FOOTER.privacy}</a>
          <a href="/external">{FOOTER.external}</a>
          <a href={LAUNCH.coverUrl}>{LANDING.top}</a>
        </nav>
      </div>
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

/** WO-025 /external: 「外部送信について」 (Google Analytics: what is sent, why, no ads, how to opt out). */
export function External() {
  return (
    <main className="launch privacy external">
      <h1>{FOOTER.external}</h1>
      <p>{EXTERNAL.lede}</p>
      <dl>
        {EXTERNAL.rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
        <dt>{EXTERNAL.optOutTitle}</dt>
        <dd>
          {EXTERNAL.optOut} <a href={EXTERNAL.optOutUrl}>{EXTERNAL.optOutUrl}</a>
        </dd>
      </dl>
      <p>
        <a href={EXTERNAL.googleUrl}>{EXTERNAL.google}</a>
      </p>
      <Footer />
    </main>
  );
}

/** After a signup: the confirmation line and the courses (this path counts the signup). */
export function Thanks() {
  return (
    <div className="lp2" style={PAGE_VARS}>
      <p className="lp2-wrap sent">{PROPOSED.signupSent}</p>
      <Courses />
      <Footer />
    </div>
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
