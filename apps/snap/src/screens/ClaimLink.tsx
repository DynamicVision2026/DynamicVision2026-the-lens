import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { app } from "../copy";
import { claimLink } from "../lib/plan";

/**
 * /app/claim?o=<order number>&s=<signature> — the button in the store's order confirmation email.
 * Unlocks the annual plan on this device (no typing), then shows プラン; if the link cannot be used,
 * プラン opens with the order number filled in and only the email to type.
 */
export function ClaimLink() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const order = (params.get("o") ?? "").replace(/\D/g, "");
    const sig = params.get("s") ?? "";
    void (async () => {
      const r = order && sig ? await claimLink(order, sig) : ({ ok: false, error: "bad_link" } as const);
      if (r.ok) nav("/app/plan?done=1", { replace: true });
      else nav(`/app/plan?order=${order}&err=${r.error}`, { replace: true });
    })();
  }, [params, nav]);
  return (
    <div className="page" data-testid="claim-link">
      <div className="reading" aria-live="polite">
        <span className="spinner" aria-hidden />
        {app.plan.linkWorking}
      </div>
    </div>
  );
}
