import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HERO_VARIANTS, type HeroVariant, PRIVACY_PATH, copy } from "../copy";
import { WAITLIST_GRADES, WORRY_OPTIONS, WaitlistSchema } from "../lib/waitlist";

const FORM_ID = "waitlist"; // {WAITLIST_URL} → this page's own form anchor

export function useMeta() {
  useEffect(() => {
    document.title = copy.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", copy.meta.description);
  }, []);
}

export function Landing() {
  useMeta();
  const [params] = useSearchParams();
  const h = params.get("h");
  const variant: HeroVariant = h && h !== "default" && (HERO_VARIANTS as readonly string[]).includes(h) ? (h as HeroVariant) : "default";
  const headline = variant === "default" ? copy.hero.headline : copy.heroAlternatives[variant];
  const subline = (variant !== "default" && copy.heroSublineAlternatives[variant]) || copy.hero.subline;

  return (
    <div className="landing">
      <header className="hero">
        <div className="brand-lg">Lens Snap</div>
        <h1 data-variant={variant}>{headline}</h1>
        <p className="hero-sub">{subline}</p>
        <a href={`#${FORM_ID}`} className="btn btn-accent">{copy.hero.cta}</a>
        <p className="muted small hero-note">{copy.hero.note}</p>
      </header>

      <section className="lp-section">
        <h2>{copy.pain.heading}</h2>
        <ul className="pain">
          {copy.pain.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="lp-section">
        <h2>{copy.promise.heading}</h2>
        <p>{copy.promise.body}</p>
      </section>

      <section className="lp-section">
        <h2>{copy.howItWorks.heading}</h2>
        <ol className="steps">
          {copy.howItWorks.steps.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-n">{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section">
        <h2>{copy.notThis.heading}</h2>
        <ul className="not-this">
          {copy.notThis.items.map((it) => (
            <li key={it.title}>
              <strong>{it.title}</strong>
              <p>{it.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-section">
        <h2>{copy.faq.heading}</h2>
        <div className="faq">
          {copy.faq.items.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-section card" id={FORM_ID}>
        <WaitlistForm variant={variant} />
      </section>
      <Footer />
    </div>
  );
}

export function Footer() {
  const f = copy.footer;
  return (
    <footer className="lp-footer">
      <a href={f.brandUrl} className="footer-brand">{f.brand}</a>
      <div>{f.company}</div>
      {/* {CONTACT_EMAIL} not set yet: the contact line is omitted. */}
      <Link to={PRIVACY_PATH}>{f.privacyLabel}</Link>
      <div>{f.copyright}</div>
    </footer>
  );
}

type Field = "email" | "grade";

function WaitlistForm({ variant }: { variant: HeroVariant }) {
  const w = copy.waitlist;
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [worry, setWorry] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { email, grade, variant, ...(worry ? { worry } : {}) };
    const parsed = WaitlistSchema.safeParse(body);
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
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  const clear = (f: Field) => setErrors(({ [f]: _, ...rest }) => rest);

  if (state === "done")
    return (
      <div className="notice notice-ok" role="status">
        <h2>{w.thanks.heading}</h2>
        <p>{w.thanks.body}</p>
      </div>
    );

  return (
    <>
      <h2>{w.heading}</h2>
      <p>{w.lead}</p>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>{w.emailLabel}</span>
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            placeholder={w.emailPlaceholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clear("email");
            }}
            aria-invalid={!!errors.email}
          />
          {errors.email && <em className="err">{errors.email}</em>}
        </label>
        <label className="field">
          <span>{w.gradeLabel}</span>
          <select
            name="grade"
            className="select"
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              clear("grade");
            }}
            aria-invalid={!!errors.grade}
          >
            <option value="">{w.gradePlaceholder}</option>
            {WAITLIST_GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {errors.grade && <em className="err">{errors.grade}</em>}
        </label>
        <fieldset className="field">
          <legend>{w.painLabel}</legend>
          <div className="seg">
            {WORRY_OPTIONS.map((o) => (
              <label key={o} className={`seg-item ${worry === o ? "is-on" : ""}`}>
                <input type="radio" name="worry" value={o} checked={worry === o} onChange={() => setWorry(o)} />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
        {state === "error" && <p className="notice notice-err">{w.errors.network}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={state === "sending"}>
          {state === "sending" ? w.submitting : w.submit}
        </button>
        <p className="muted small">{w.privacyNote}</p>
      </form>
    </>
  );
}
