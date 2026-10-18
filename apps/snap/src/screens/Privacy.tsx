import { Link } from "react-router-dom";
import { copy, landingUi } from "../copy";
import { Footer, useMeta } from "./Landing";

/** /privacy — built only from existing copy (privacy FAQ, notThis privacy item, waitlist note). */
export function Privacy() {
  useMeta();
  const faq = copy.faq.items[1];
  const photo = copy.notThis.items[2];
  return (
    <div className="landing">
      <header className="hero hero-compact">
        <Link to="/" className="brand-lg">Lens Snap</Link>
        <h1>{copy.footer.privacyLabel}</h1>
        <p className="muted">{landingUi.privacyIntro}</p>
      </header>
      <section className="lp-section">
        <h2>{photo.title}</h2>
        <p>{photo.body}</p>
      </section>
      <section className="lp-section">
        <h2>{faq.q}</h2>
        <p>{faq.a}</p>
      </section>
      <section className="lp-section">
        <h2>{copy.waitlist.heading}</h2>
        <p>{copy.waitlist.privacyNote}</p>
      </section>
      <p><Link to="/" className="btn btn-ghost">{landingUi.backToTop}</Link></p>
      <Footer />
    </div>
  );
}
