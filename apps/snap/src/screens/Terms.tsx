import { Link } from "react-router-dom";
import { LEGAL_URL } from "../lp-copy";
import { Footer, useMeta } from "./Landing";

import { TERMS } from "../terms";

/** /terms — 利用規約 (draft: have it reviewed before paid sales scale up). Text in src/terms.*.ts. */
export function Terms() {
  useMeta(TERMS.metaTitle, TERMS.metaDesc);
  return (
    <div className="lp">
      <main className="lp-wrap lp-narrow lp-doc" data-testid="terms">
        <Link to="/" className="lp-logo lp-doc-logo">
          {TERMS.logo}
        </Link>
        <h1 className="lp-h2">{TERMS.title}</h1>
        {TERMS.note && <p className="lp-muted">{TERMS.note}</p>}
        {TERMS.articles.map(([h, ps], i) => (
          <section key={h}>
            <h2 className="lp-h3">{h}</h2>
            {i === TERMS.listIndex ? (
              <ol>
                {ps.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            ) : (
              ps.map((p) => <p key={p}>{p}</p>)
            )}
          </section>
        ))}
        <p className="lp-muted">
          {TERMS.datedBefore}
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer">
            {TERMS.legalLink}
          </a>
          {TERMS.datedAfter}
        </p>
      </main>
      <Footer />
    </div>
  );
}
