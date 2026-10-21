import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { type HeroVariant, PRIVACY_PATH, copy } from "../copy";
import { normalizeSrc, resolveVariant, type Source } from "../lib/attribution";
import { fetchPilotGate } from "../lib/pilot";
import { BUY_URL, LEGAL_URL, LENS_COURSES_URL, lp } from "../lp-copy";
import { readPref, writePref } from "../state";
import { WAITLIST_GRADES, WaitlistSchema } from "../lib/waitlist";

const FORM_ID = "waitlist";
const img = (name: string) => `/lp/${name}.webp`;

export function useMeta(title: string = lp.meta.title, description: string = lp.meta.description) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}

/**
 * The landing page. While the app is invite-only (招待コード on the server) the main button is the
 * waitlist; once it is open, 「無料ではじめる」 goes straight to the app.
 */
export function Landing() {
  useMeta();
  const [params] = useSearchParams();
  const variant = useMemo<HeroVariant>(() => {
    const r = resolveVariant(params.get("h"), readPref("hero-variant"));
    if (r.store) writePref("hero-variant", r.variant);
    return r.variant;
  }, [params]);
  const src = normalizeSrc(params.get("src"));
  const [gated, setGated] = useState<boolean | null>(null);
  useEffect(() => {
    void fetchPilotGate().then(setGated);
  }, []);
  const h = lp.hero;
  const Start = ({ big = false }: { big?: boolean }) =>
    gated ? (
      <a href={`#${FORM_ID}`} className={`btn btn-accent${big ? " lp-btn-big" : ""}`} data-testid="lp-start">
        {h.waitlist}
      </a>
    ) : (
      <Link to="/app" className={`btn btn-accent${big ? " lp-btn-big" : ""}`} data-testid="lp-start">
        {h.start}
      </Link>
    );

  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="lp-wrap lp-bar-in">
          <a href="#top" className="lp-logo" aria-label="つまずきマップ">
            <HexMark />
            つまずきマップ
          </a>
          <nav className="lp-nav" aria-label="ページ内リンク">
            {lp.nav.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <Start />
        </div>
      </header>

      <section className="lp-hero" id="top">
        <div className="lp-wrap lp-hero-in">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">{h.eyebrow}</p>
            <p className="lp-pre">{h.pre}</p>
            <h1 className="lp-h1">
              {h.title[0]}
              <br />
              <span>{h.title[1]}</span>
            </h1>
            <p className="lp-lead">{h.body}</p>
            <div className="lp-ctas">
              <Start big />
              <a href="#price" className="btn lp-btn-ghost">
                {h.price}
              </a>
            </div>
            <p className="lp-note">{gated ? h.waitlistNote : h.startNote}</p>
            <ul className="lp-badges">
              {h.badges.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
          <div className="lp-hero-art">
            <img className="lp-tablet" src={img("map-ipad")} alt={h.imgAlt} width={1600} height={1199} />
            <img className="lp-phone" src={img("phone-confirm")} alt={h.phoneAlt} width={720} height={1558} />
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2 center">{lp.pain.heading}</h2>
          <div className="lp-pain">
            {lp.pain.items.map((p) => (
              <figure key={p.who} className="lp-card lp-pain-card">
                <figcaption>{p.who}</figcaption>
                <blockquote>「{p.text}」</blockquote>
              </figure>
            ))}
          </div>
          <p className="lp-answer">{lp.pain.answer}</p>
        </div>
      </section>

      <section className="lp-sec lp-tint" id="video">
        <div className="lp-wrap lp-video-wrap">
          <p className="lp-kicker center">{lp.video.kicker}</p>
          <h2 className="lp-h2 center">{lp.video.heading}</h2>
          <video
            className="lp-video"
            data-testid="lp-video"
            src="/lp/guide.mp4"
            poster="/lp/guide-poster.jpg"
            controls
            preload="none"
            playsInline
            width={1280}
            height={720}
            aria-label={lp.video.alt}
          />
          <p className="lp-video-note">{lp.video.note}</p>
        </div>
      </section>

      <section className="lp-sec lp-dark" id="map">
        <div className="lp-wrap lp-split">
          <div>
            <p className="lp-kicker">{lp.map.kicker}</p>
            <h2 className="lp-h2">{lp.map.heading}</h2>
            <p>{lp.map.body}</p>
            <h3 className="lp-h3">{lp.map.ladderHeading}</h3>
            <ol className="lp-ladder">
              {lp.map.ladder.map((l) => (
                <li key={l.name} data-tone={l.tone}>
                  <span className="lp-hex" aria-hidden />
                  <b>{l.name}</b>
                  <span>{l.note}</span>
                </li>
              ))}
            </ol>
          </div>
          <img className="lp-shot" src={img("map-continent")} alt={lp.map.imgAlt} width={1600} height={1199} loading="lazy" />
        </div>
      </section>

      <section className="lp-sec" id="how">
        <div className="lp-wrap">
          <p className="lp-kicker center">{lp.how.kicker}</p>
          <h2 className="lp-h2 center">{lp.how.heading}</h2>
          <ol className="lp-steps">
            {lp.how.steps.map((s, i) => (
              <li key={s.title} className="lp-card lp-step">
                <span className="lp-step-n">{i + 1}</span>
                <h3 className="lp-h3">{s.title}</h3>
                <p>{s.body}</p>
                <img src={img(s.img)} alt={s.alt} width={720} height={1558} loading="lazy" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-sec lp-tint">
        <div className="lp-wrap">
          <p className="lp-kicker center">{lp.features.kicker}</p>
          <h2 className="lp-h2 center">{lp.features.heading}</h2>
          <div className="lp-features">
            {lp.features.items.map((f, i) => (
              <article key={f.title} className={`lp-feature${i % 2 ? " is-flip" : ""}`}>
                <img className="lp-shot" src={img(f.img)} alt={f.alt} width={1600} height={1199} loading="lazy" />
                <div>
                  <h3 className="lp-h3">{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2 center">{lp.scenes.heading}</h2>
          <div className="lp-scenes">
            {lp.scenes.items.map((s) => (
              <div key={s.title} className="lp-card lp-scene" data-tone={s.tone}>
                <h3 className="lp-h3">{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-tint" id="price">
        <div className="lp-wrap">
          <p className="lp-kicker center">{lp.price.kicker}</p>
          <h2 className="lp-h2 center">{lp.price.heading}</h2>
          <p className="center lp-muted">{lp.price.note}</p>
          <div className="lp-plans">
            <div className="lp-card lp-plan" data-testid="lp-plan-free">
              <h3>{lp.price.free.name}</h3>
              <p className="lp-plan-price">{lp.price.free.price}</p>
              <ul>
                {lp.price.free.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <Start />
            </div>
            <div className="lp-card lp-plan is-best" data-testid="lp-plan-annual">
              <span className="lp-plan-badge">{lp.price.annual.badge}</span>
              <h3>{lp.price.annual.name}</h3>
              <p className="lp-plan-price">
                {lp.price.annual.price}
                <small>{lp.price.annual.unit}</small>
              </p>
              <p className="lp-muted">{lp.price.annual.perDay}</p>
              <ul>
                {lp.price.annual.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <a href={BUY_URL} className="btn btn-primary" target="_blank" rel="noopener noreferrer" data-testid="lp-buy">
                {lp.price.annual.cta}
              </a>
            </div>
          </div>
          <div className="lp-card lp-bundle" data-testid="lp-bundle">
            <p className="lp-kicker">{lp.price.bundle.kicker}</p>
            <h3 className="lp-h3">{lp.price.bundle.title}</h3>
            <p>{lp.price.bundle.body}</p>
            <ul className="lp-bundle-courses">
              {lp.price.bundle.courses.map((c) => (
                <li key={c.name}>
                  <b>{c.name}</b>
                  <span>{c.who}</span>
                </li>
              ))}
            </ul>
            <a href={LENS_COURSES_URL} className="btn btn-ghost" target="_blank" rel="noopener noreferrer" data-testid="lp-bundle-link">
              {lp.price.bundle.cta}
            </a>
          </div>
          <div className="lp-price-notes">
            <p>{lp.price.after}</p>
            <p>{lp.price.pay}</p>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2 center">{lp.trust.heading}</h2>
          <div className="lp-trust">
            {lp.trust.items.map((t) => (
              <div key={t.title} className="lp-card">
                <h3 className="lp-h3">{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-tint" id="faq">
        <div className="lp-wrap lp-narrow">
          <h2 className="lp-h2 center">{lp.faq.heading}</h2>
          <div className="faq">
            {lp.faq.items.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-dark lp-final">
        <div className="lp-wrap lp-narrow center">
          <h2 className="lp-h2">{lp.final.heading}</h2>
          <p>{lp.final.body}</p>
          <Start big />
        </div>
      </section>

      {gated && (
        <section className="lp-sec" id={FORM_ID}>
          <div className="lp-wrap lp-narrow">
            <div className="lp-card">
              <WaitlistForm variant={variant} src={src} />
            </div>
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}

function HexMark() {
  return (
    <svg className="lp-mark" viewBox="0 0 100 115.47" aria-hidden focusable="false">
      <path d="M50 0 L100 28.87 L100 86.6 L50 115.47 L0 86.6 L0 28.87 Z" />
    </svg>
  );
}

export function Footer() {
  const f = lp.footer;
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-in">
        <div className="lp-logo">
          <HexMark />
          {f.brand}
        </div>
        <nav className="lp-footer-links" aria-label="サイト情報">
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer">
            {f.legal}
          </a>
          <Link to={PRIVACY_PATH}>{f.privacy}</Link>
          <Link to="/terms">{f.terms}</Link>
          <a href={f.familyUrl}>{f.family}</a>
        </nav>
        <p>{f.operator}</p>
        <p>{f.copyright}</p>
      </div>
    </footer>
  );
}

type Field = "email" | "grade";

function WaitlistForm({ variant, src }: { variant: HeroVariant; src: Source }) {
  const w = copy.waitlist;
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = WaitlistSchema.safeParse({ email, grade, variant, src });
    if (!parsed.success) {
      const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
      setErrors({
        ...(bad.has("email") ? { email: email.trim() ? w.errors.emailInvalid : w.errors.emailRequired } : {}),
        ...(bad.has("grade") ? { grade: w.errors.gradeRequired } : {}),
      });
      return;
    }
    setErrors({});
    setState("sending");
    try {
      const r = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  if (state === "done")
    return (
      <div className="notice notice-ok" role="status">
        <h2>{w.thanks.heading}</h2>
        <p>{w.thanks.body}</p>
      </div>
    );
  return (
    <>
      <h2 className="lp-h2">{w.heading}</h2>
      <p>{w.lead}</p>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>{w.emailLabel}</span>
          <input type="email" name="email" inputMode="email" autoComplete="email" placeholder={w.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          {errors.email && <em className="err">{errors.email}</em>}
        </label>
        <label className="field">
          <span>{w.gradeLabel}</span>
          <select name="grade" className="select" value={grade} onChange={(e) => setGrade(e.target.value)} aria-invalid={!!errors.grade}>
            <option value="">{w.gradePlaceholder}</option>
            {WAITLIST_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {errors.grade && <em className="err">{errors.grade}</em>}
        </label>
        {state === "error" && <p className="notice notice-err">{w.errors.network}</p>}
        <button type="submit" className="btn btn-accent btn-block" disabled={state === "sending"}>
          {state === "sending" ? w.submitting : w.submit}
        </button>
        <p className="small muted">{w.privacyNote}</p>
      </form>
    </>
  );
}
