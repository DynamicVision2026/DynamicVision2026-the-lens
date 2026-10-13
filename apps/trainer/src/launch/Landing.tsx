import { getCard, LensScene, loadBundle } from '@lens/scenes';
import { LAUNCH } from '../launch.config';
import { FOOTER, LANDING, PREORDER, PRIVACY, PROPOSED } from './copy';
import { preorderHref } from './tracking';
import { Fragment, useEffect } from 'react';
import { Signup } from './Signup';

/** Small line icons for the three points (drawn in the lens colour via currentColor). */
const POINT_ICONS = [
  ['M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12z', 'M14.5 14.5L20 20'],
  ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M14 16.5l2 2 4-4'],
  ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
];

const PREORDER_PATH = '/go/preorder';

export function Landing({ short }: { short: string | null }) {
  // Not the Free Lens problem (enclose-001), so the hero doesn't give its answer away. Shown with every
  // corner triangle shaded and labelled, so the numbers read as their areas.
  const hero = getCard('enclose-002');
  const keyframes = hero?.animation?.keyframes ?? [];
  const heroKeyframe = keyframes.includes('label_corners') ? keyframes.indexOf('label_corners') : Math.max(0, keyframes.length - 1);
  return (
    <main className="launch">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">{LANDING.eyebrow}</p>
          <h1>
            {/* Break only after 「、」 and 「を」 (h1 is keep-all), so 「選ぶ。」 stays together. */}
            {LANDING.h1.split(/(?<=[、を])/).map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <wbr />}
                {part}
              </Fragment>
            ))}
          </h1>
          <p className="sub">{LANDING.sub}</p>
          <div className="ctas">
            <a className="primary start" href="/play/enclose-001">
              {LANDING.start}
            </a>
            <a className="secondary" href="/check">
              {PROPOSED.checkLink}
            </a>
          </div>
        </div>
        {hero && (
          <figure className="hero-figure">
            <LensScene card={hero} keyframe={heroKeyframe} t={1} />
            <figcaption>{LANDING.heroCaption}</figcaption>
          </figure>
        )}
      </header>

      <ul className="points">
        {LANDING.points.map((text, i) => (
          <li key={i}>
            <svg viewBox="0 0 24 24" width={32} height={32} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {POINT_ICONS[i]!.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <Signup short={short} />
      <Preorder />
      <Footer />
    </main>
  );
}

/** The founder offer; numbers from bundle.passes and the seats-left count from launch.config.ts. */
export function Preorder() {
  const pass = loadBundle().passes?.find((p) => p.id === LAUNCH.passId);
  if (!pass?.price_jpy || !pass.early_price_jpy || !pass.founder_seats) return null;
  const seatsLeft = LAUNCH.founderSeatsLeft;
  return (
    <section className="preorder-block">
      <h2>{PREORDER.title(pass.founder_seats)}</h2>
      <p className="stage">{PREORDER.stage}</p>
      <p className="price">
        <strong>{PREORDER.price(pass.early_price_jpy, pass.founder_seats, pass.price_jpy)}</strong>
      </p>
      {seatsLeft !== null && <p className="seats">{PREORDER.seatsLeft(seatsLeft)}</p>}
      <ul className="includes">
        {PREORDER.includes(pass.term_months ?? 12, pass.devices ?? 1).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>{PREORDER.delivery}</p>
      <a className="primary" href={PREORDER_PATH}>
        {PREORDER.button}
      </a>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <a href="/privacy">{FOOTER.privacy}</a>
      <span aria-hidden>・</span>
      <a href={LAUNCH.tokushohoUrl}>{FOOTER.tokushoho}</a>
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

/** After a signup: the confirmation line and the preorder block (this path counts the signup). */
export function Thanks() {
  return (
    <main className="launch">
      <p className="sent">{PROPOSED.signupSent}</p>
      <Preorder />
      <Footer />
    </main>
  );
}

/**
 * /go/preorder: counts the preorder click as a page view, then forwards to the store's preorder
 * product with the Short as UTM parameters. The link is there too, in case the forward is blocked.
 */
export function GoPreorder({ short }: { short: string | null }) {
  const href = preorderHref(LAUNCH.preorderUrl, short);
  useEffect(() => {
    // A short pause lets the analytics beacon send before the page changes.
    const id = window.setTimeout(() => window.location.replace(href), 300);
    return () => window.clearTimeout(id);
  }, [href]);
  return (
    <main className="launch">
      <a className="primary" href={href}>
        {PREORDER.button}
      </a>
    </main>
  );
}
