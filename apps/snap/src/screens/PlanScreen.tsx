import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { app } from "../copy";
import { type PlanError, type PlanView, claimOrder, jaDate, redeemCode, resetDay, usePlan } from "../lib/plan";

const p = app.plan;

/** プラン: where the free count stands, the ¥5,800 pass (buy / unlock by order / code). */
export function PlanScreen() {
  const { plan, setPlan } = usePlan();
  const [justDone, setJustDone] = useState(false);
  const done = (v: PlanView) => {
    setPlan(v);
    setJustDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="page page-plan" data-testid="plan-screen">
      <h1>{p.title}</h1>
      {!plan ? (
        <p className="muted">{p.offline}</p>
      ) : plan.plan === "pass" ? (
        <PassCard plan={plan} fresh={justDone} />
      ) : (
        <>
          <FreeCard plan={plan} />
          <Offer buyUrl={plan.buyUrl} />
          <div className="plan-forms">
            <ClaimForm onDone={done} />
            <CodeForm onDone={done} />
          </div>
        </>
      )}
    </div>
  );
}

function FreeCard({ plan }: { plan: Extract<PlanView, { plan: "free" }> }) {
  const pct = Math.min(100, Math.round((plan.used / Math.max(1, plan.limit)) * 100));
  return (
    <section className="card plan-status" data-testid="plan-free">
      {plan.expired && <p className="notice notice-warn">{p.expired}</p>}
      <span className="plan-kicker">{p.free}</span>
      <p className="plan-big" data-testid="plan-left">
        {p.freeLeft(plan.remaining, plan.limit)}
      </p>
      <div className="plan-meter" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small">{p.resets(resetDay(plan.resetsAt))}</p>
    </section>
  );
}

function PassCard({ plan, fresh }: { plan: Extract<PlanView, { plan: "pass" }>; fresh: boolean }) {
  return (
    <section className="card plan-status is-pass" data-testid="plan-pass">
      {fresh && (
        <p className="notice notice-ok" role="status" data-testid="plan-done">
          {p.done}
        </p>
      )}
      <span className="plan-kicker">{p.pass}</span>
      <p className="plan-big" data-testid="plan-until">
        {p.passUntil(jaDate(plan.expiresAt))}
      </p>
      <p className="muted small">{plan.kind === "code" ? p.passFromCode : p.passFromOrder}</p>
      <div className="plan-code">
        <span className="small muted">{p.yourCode}</span>
        <code data-testid="plan-code">{plan.license}</code>
        <p className="small muted">{p.codeNote}</p>
      </div>
      <Link to="/app/snap" className="btn btn-primary btn-block">
        {app.nav.snap}
      </Link>
    </section>
  );
}

export function Offer({ buyUrl, compact = false }: { buyUrl: string | null; compact?: boolean }) {
  return (
    <section className={`card plan-offer${compact ? " is-compact" : ""}`} data-testid="plan-offer">
      <span className="plan-kicker">{p.pass}</span>
      <p className="plan-price">
        <b>{p.price}</b>
        <span>{p.priceUnit}</span>
        <small>{p.perDay}</small>
      </p>
      <ul className="plan-benefits">
        {p.benefits.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {buyUrl && (
        <a className="btn btn-primary btn-block" href={buyUrl} target="_blank" rel="noopener noreferrer" data-testid="plan-buy">
          {p.buy}
        </a>
      )}
      <p className="small muted">{p.oneTime}</p>
      {!compact && <p className="small muted">{p.buyNote}</p>}
    </section>
  );
}

function errorText(e: PlanError) {
  return p.errors[e] ?? p.errors.error;
}

function ClaimForm({ onDone }: { onDone: (v: PlanView) => void }) {
  const [order, setOrder] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<PlanError | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!order.trim() || !email.includes("@")) return setErr("invalid");
    setBusy(true);
    setErr(null);
    const r = await claimOrder(order, email);
    setBusy(false);
    if (r.ok) onDone(r.view);
    else setErr(r.error);
  };
  return (
    <form className="card plan-form" onSubmit={submit} data-testid="plan-claim">
      <h2>{p.claimTitle}</h2>
      <p className="small muted">{p.claimBody}</p>
      <label className="field">
        <span>{p.orderLabel}</span>
        <input className="input" name="order" inputMode="numeric" autoComplete="off" value={order} onChange={(e) => setOrder(e.target.value)} />
      </label>
      <label className="field">
        <span>{p.emailLabel}</span>
        <input className="input" name="email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {err && (
        <p className="notice notice-err" role="alert" data-testid="plan-claim-error">
          {errorText(err)}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? p.working : p.claim}
      </button>
    </form>
  );
}

function CodeForm({ onDone }: { onDone: (v: PlanView) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<PlanError | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await redeemCode(code);
    setBusy(false);
    if (r.ok) onDone(r.view);
    else setErr(r.error);
  };
  return (
    <form className="card plan-form" onSubmit={submit} data-testid="plan-redeem">
      <h2>{p.codeTitle}</h2>
      <p className="small muted">{p.codeBody}</p>
      <label className="field">
        <span>{p.codeLabel}</span>
        <input
          className="input plan-code-input"
          name="code"
          placeholder="LS-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      {err && (
        <p className="notice notice-err" role="alert" data-testid="plan-redeem-error">
          {errorText(err)}
        </p>
      )}
      <button type="submit" className="btn btn-ghost btn-block" disabled={busy || code.trim().length < 12}>
        {busy ? p.working : p.redeem}
      </button>
    </form>
  );
}

/** Small status pill (撮る, ふりかえり): 「無料 今月あと27枚」 / 「年間プラン」 → プラン. */
export function PlanChip({ plan }: { plan: PlanView | null }) {
  if (!plan) return null;
  const low = plan.plan === "free" && plan.remaining <= 5;
  return (
    <Link to="/app/plan" className={`plan-chip${plan.plan === "pass" ? " is-pass" : ""}${low ? " is-low" : ""}`} aria-label={p.chipLabel} data-testid="plan-chip">
      {plan.plan === "pass" ? p.chipPass : p.chipFree(plan.remaining)}
      <span aria-hidden> ›</span>
    </Link>
  );
}

/** Shown on 撮る when the month's free photos are used up. */
export function QuotaCard({ plan }: { plan: PlanView | null }) {
  const free = plan?.plan === "free" ? plan : null;
  return (
    <div className="quota" data-testid="quota-card">
      <div className="notice notice-warn" role="alert">
        <strong>{p.quotaTitle(free?.limit ?? 30)}</strong>
        {free && <span>{p.quotaBody(resetDay(free.resetsAt))}</span>}
      </div>
      <Offer buyUrl={plan?.buyUrl ?? null} compact />
      <Link to="/app/plan" className="btn btn-ghost btn-block" data-testid="quota-to-plan">
        {p.claimTitle}・{p.codeTitle.split("・")[0]}
      </Link>
    </div>
  );
}
