import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { app } from "../copy";
import { type PlanError, type PlanView, claimOrder, jaDate, monthUse, redeemCode, resetDay, usePlan } from "../lib/plan";

const p = app.plan;

/** プラン: where the free count stands, the ¥5,800 pass (buy / unlock by order / code). */
export function PlanScreen() {
  const { plan, setPlan } = usePlan();
  // from the store email's link (/app/claim): ?done=1 after unlocking, or ?order=…&err=… to finish by hand
  const [params] = useSearchParams();
  const fromLink = params.get("done") === "1";
  const [justDone, setJustDone] = useState(fromLink);
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
        <PassCard plan={plan} fresh={justDone} fromLink={fromLink} />
      ) : (
        <>
          <FreeCard plan={plan} />
          <Offer buyUrl={plan.buyUrl} />
          <div className="plan-forms">
            <ClaimForm onDone={done} initialOrder={params.get("order") ?? ""} initialError={(params.get("err") as PlanError | null) ?? null} />
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
      {plan.remaining === 0 && (
        <p className="notice notice-warn" role="alert" data-testid="plan-trial-out">
          {p.quotaTitle(plan.limit)}
        </p>
      )}
      <span className="plan-kicker">{p.free}</span>
      <p className="plan-big" data-testid="plan-left">
        {p.freeLeft(plan.remaining, plan.limit)}
      </p>
      <div className="plan-meter" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small">{p.trialNote}</p>
    </section>
  );
}

function PassCard({ plan, fresh, fromLink = false }: { plan: Extract<PlanView, { plan: "pass" }>; fresh: boolean; fromLink?: boolean }) {
  return (
    <section className="card plan-status is-pass" data-testid="plan-pass">
      {fresh && (
        <p className="notice notice-ok" role="status" data-testid="plan-done">
          {p.done}
        </p>
      )}
      <MonthUsage plan={plan} />
      <p className="muted small">{plan.kind === "code" ? p.passFromCode : p.passFromOrder}</p>
      <div className="plan-code">
        <span className="small muted">{p.yourCode}</span>
        <code data-testid="plan-code">{plan.license}</code>
        <p className="small muted">{fromLink ? p.linkDoneNote : p.codeNote}</p>
      </div>
      <Link to="/app/snap" className="btn btn-primary btn-block">
        {app.nav.snap}
      </Link>
    </section>
  );
}

/** 「今月の撮影枚数」: the pass's month (shared by its devices), like the free card. */
export function MonthUsage({ plan }: { plan: Extract<PlanView, { plan: "pass" }> }) {
  const { pct, level } = monthUse(plan);
  const day = resetDay(plan.resetsAt);
  return (
    <div className={`plan-month is-${level}`} data-testid="plan-month" data-level={level}>
      {level === "low" && (
        <p className="notice notice-warn" role="status" data-testid="plan-month-low">
          {p.monthLow(plan.remaining)}
        </p>
      )}
      {level === "out" && (
        <p className="notice notice-warn" role="alert" data-testid="plan-month-out">
          {p.monthOut(plan.limit, day)}
        </p>
      )}
      <span className="plan-kicker">{p.monthTitle}</span>
      <p className="plan-big" data-testid="plan-month-count">
        {p.monthCount(plan.used, plan.limit, pct)}
      </p>
      <div className="plan-meter" role="progressbar" aria-valuemin={0} aria-valuemax={plan.limit} aria-valuenow={plan.used} aria-label={p.monthTitle}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small">{p.monthLeft(plan.remaining, day)}</p>
      <p className="small plan-valid" data-testid="plan-until">
        {p.passValid(jaDate(plan.expiresAt))}
      </p>
    </div>
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

function ClaimForm({ onDone, initialOrder = "", initialError = null }: { onDone: (v: PlanView) => void; initialOrder?: string; initialError?: PlanError | null }) {
  const [order, setOrder] = useState(initialOrder.replace(/\D/g, ""));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<PlanError | null>(initialError && p.errors[initialError] ? initialError : null);
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

/** Small status pill (撮る, ふりかえり): 「お試し あと27枚」 / 「年間プラン｜今月 37／200枚」 → プラン. */
export function PlanChip({ plan }: { plan: PlanView | null }) {
  if (!plan) return null;
  if (plan.plan === "pass") {
    const { level } = monthUse(plan);
    return (
      <Link to="/app/plan" className={`plan-chip is-pass${level !== "ok" ? " is-low" : ""}`} aria-label={p.chipLabel} data-testid="plan-chip" data-level={level}>
        <span className="plan-chip-badge">{p.chipPass}</span>
        <span data-testid="plan-chip-count">{p.chipMonth(plan.used, plan.limit)}</span>
        <span aria-hidden> ›</span>
      </Link>
    );
  }
  const low = plan.remaining <= 5;
  return (
    <Link to="/app/plan" className={`plan-chip${low ? " is-low" : ""}`} aria-label={p.chipLabel} data-testid="plan-chip">
      {p.chipFree(plan.remaining)}
      <span aria-hidden> ›</span>
    </Link>
  );
}

/** 撮る when the pass's month is used up: only new photos stop; everything already saved keeps working. */
export function PassOutCard({ plan }: { plan: Extract<PlanView, { plan: "pass" }> }) {
  return (
    <div className="quota" data-testid="pass-out-card">
      <div className="notice notice-warn" role="alert">
        <strong>{p.monthOut(plan.limit, resetDay(plan.resetsAt))}</strong>
        <span>{p.monthOutKeep}</span>
      </div>
      <Link to="/app/plan" className="btn btn-ghost btn-block">
        {p.monthTitle}
      </Link>
    </div>
  );
}

/** Shown on 撮る when the free trial is used up: the offer with the buy button; saved pages keep working. */
export function QuotaCard({ plan }: { plan: PlanView | null }) {
  const free = plan?.plan === "free" ? plan : null;
  return (
    <div className="quota" data-testid="quota-card">
      <div className="notice notice-warn" role="alert">
        <strong>{p.quotaTitle(free?.limit ?? 30)}</strong>
        <span>{p.quotaBody}</span>
      </div>
      <Offer buyUrl={plan?.buyUrl ?? null} compact />
      <Link to="/app/plan" className="btn btn-ghost btn-block" data-testid="quota-to-plan">
        {p.claimTitle}・{p.codeTitle.split("・")[0]}
      </Link>
    </div>
  );
}
