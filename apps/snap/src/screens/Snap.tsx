import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InstallTip } from "../components/InstallTip";
import { PilotCodeForm } from "../components/PilotCodeForm";
import { UnitSelect } from "../components/UnitSelect";
import { ZoomPhoto } from "../components/ZoomPhoto";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import { preparePhoto } from "../lib/image";
import { judgeDisagrees, needsUnitCheck } from "../lib/marks";
import { type DraftProblem, type SavedPage, draftFromResult, pageFromDraft, withParentMark } from "../lib/model";
import { useLayout } from "../lib/layout";
import { type ReadFailure, clearPilotCode, readFailure } from "../lib/pilot";
import { planHeaders, usePlan } from "../lib/plan";
import { writePref } from "../state";
import { PassOutCard, PlanChip, QuotaCard } from "./PlanScreen";
import { LOW_CONFIDENCE, litMapUrl } from "../lib/review";
import { afterSave } from "../lib/pwa";
import { savePage } from "../lib/store";
import { type Mark, type PageResult, PageResultSchema } from "../reader/schema";

type State =
  | { s: "idle" }
  | { s: "reading" }
  | { s: "error"; why: Exclude<ReadFailure, "pilot_code" | "quota"> }
  | { s: "quota" }
  | { s: "pilot" }
  | { s: "retake"; result: PageResult; thumb?: SavedPage["photo"] }
  | { s: "confirm"; result: PageResult; draft: DraftProblem[]; thumb?: SavedPage["photo"] };

export function Snap({ grade }: { grade: Grade }) {
  const [st, setSt] = useState<State>({ s: "idle" });
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null); // re-sent after a new 招待コード
  const nav = useNavigate();
  const { plan, reload: reloadPlan } = usePlan();

  async function onFile(file: File | undefined | null) {
    if (!file) return;
    lastFile.current = file;
    setSt({ s: "reading" });
    try {
      const { upload, thumb } = await preparePhoto(file);
      const fd = new FormData();
      fd.append("grade", grade);
      fd.append("image", upload, file.name || "photo.jpg");
      let r = await fetch("/api/read", { method: "POST", body: fd, headers: await planHeaders() });
      if (r.status === 401) {
        // this device's id is not accepted any more: get a new one and try once more
        writePref("device", "");
        r = await fetch("/api/read", { method: "POST", body: fd, headers: await planHeaders() });
      }
      if (!r.ok) {
        const why = readFailure(r.status, await r.json().catch(() => null));
        if (why === "pilot_code") {
          clearPilotCode();
          setSt({ s: "pilot" });
        } else if (why === "quota") {
          void reloadPlan();
          setSt({ s: "quota" });
        } else setSt({ s: "error", why });
        return;
      }
      void reloadPlan();
      const result = PageResultSchema.parse(await r.json());
      lastFile.current = null;
      if (result.retake) setSt({ s: "retake", result, thumb });
      else setSt({ s: "confirm", result, draft: draftFromResult(result), thumb });
    } catch {
      setSt({ s: "error", why: "error" });
    }
  }

  const inputs = (
    <>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={pick} type="file" accept="image/*" hidden data-testid="file-input" onChange={(e) => onFile(e.target.files?.[0])} />
    </>
  );
  const reset = () => {
    if (cam.current) cam.current.value = "";
    if (pick.current) pick.current.value = "";
    setSt({ s: "idle" });
  };

  if (st.s === "confirm")
    return (
      <Confirm
        grade={grade}
        state={st}
        onChange={(draft) => setSt({ ...st, draft })}
        onCancel={reset}
        onSave={async () => {
          const page = pageFromDraft(st.draft, { grade, pageType: st.result.pageType, score: st.result.score, photo: st.thumb });
          await savePage(page);
          afterSave(); // first 保存: ask the browser to keep this data (persistent storage)
          // Straight to the map: the units this page went into light up.
          nav(litMapUrl(page));
        }}
      />
    );

  // The month is used up (free or pass): say so instead of the camera button; saved pages stay as they are.
  const outOfMonth = st.s === "quota" || (st.s === "idle" && plan !== null && plan.remaining === 0);
  return (
    <div className="page snap-page">
      {inputs}
      <div className="snap-head">
        <h1>{app.snap.title}</h1>
        <PlanChip plan={plan} />
      </div>
      <p className="muted">{app.snap.body}</p>
      {outOfMonth ? plan?.plan === "pass" ? <PassOutCard plan={plan} /> : <QuotaCard plan={plan} /> : null}

      {st.s === "retake" && (
        <div className="notice notice-warn" role="alert">
          <strong>{app.snap.retake}</strong>
          {st.result.problems.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setSt({ s: "confirm", result: st.result, draft: draftFromResult(st.result), thumb: st.thumb })}>
              {app.confirm.title}
            </button>
          )}
        </div>
      )}
      {st.s === "error" && (
        <p className="notice notice-err" role="alert">
          {st.why === "rate_limited"
            ? app.snap.rateLimited
            : st.why === "daily_cap"
              ? app.snap.dailyCap
              : st.why === "device_limit"
                ? app.plan.deviceLimit
                : app.snap.error}
        </p>
      )}
      {st.s === "pilot" && (
        <div className="card">
          <PilotCodeForm again submitLabel={app.pilot.retry} onDone={() => void onFile(lastFile.current)} />
        </div>
      )}

      {st.s === "pilot" || outOfMonth ? null : st.s === "reading" ? (
        <div className="reading" aria-live="polite">
          <span className="spinner" aria-hidden />
          {app.snap.reading}
        </div>
      ) : (
        <div className="snap-actions">
          <button type="button" className="btn btn-primary btn-xl" onClick={() => cam.current?.click()}>
            {st.s === "retake" ? app.snap.retry : app.snap.camera}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => pick.current?.click()}>
            {app.snap.file}
          </button>
        </div>
      )}
      <p className="muted small center">{app.snap.privacy}</p>
      {st.s === "idle" && <InstallTip />}
    </div>
  );
}

function Confirm(props: {
  grade: Grade;
  state: Extract<State, { s: "confirm" }>;
  onChange: (d: DraftProblem[]) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const { result, draft, thumb } = props.state;
  const [saving, setSaving] = useState(false);
  // tablets (portrait and landscape): the photo on the left (pinch to zoom), the problem cards on the right
  const twoCol = useLayout().layout !== "phone" && !!thumb;
  const set = (i: number, patch: Partial<DraftProblem>) =>
    props.onChange(draft.map((p, j) => (j === i ? { ...p, ...patch, edited: true } : p)));

  const main = (
    <>
      <h1>{app.confirm.title}</h1>
      <p className="muted">{app.confirm.body}</p>
      <div className="row gap wrap meta">
        <span className="pill">{app.pageType[result.pageType]}</span>
        {result.score && <span className="pill">{app.confirm.score(result.score)}</span>}
      </div>
      {draft.length === 0 && <p className="notice">{app.confirm.empty}</p>}
      <ol className="cards">
        {draft.map((p, i) => (
          <li key={i} className={`card problem ${p.mark === "✕" ? "is-wrong" : ""}`} data-testid="problem-card">
            <div className="problem-head">
              <span className="problem-n">{app.confirm.problem(i + 1)}</span>
              {!p.edited && p.confidence < LOW_CONFIDENCE && <span className="pill pill-warn">{app.confirm.low}</span>}
              {needsUnitCheck(p) && (
                <span className="pill pill-amber" data-testid="unit-check">
                  {app.confirm.unitCheck}
                </span>
              )}
            </div>
            <p className="problem-q">{p.q}</p>
            <label className="field">
              <span>{app.confirm.unit}</span>
              <UnitSelect grade={props.grade} value={p.unit} suggest={p.unitAlt} onChange={(unit) => set(i, { unit, unitEdited: true })} />
            </label>
            <label className="field">
              <span>{app.confirm.answer}</span>
              <input value={p.answer ?? ""} placeholder={app.confirm.noAnswer} onChange={(e) => set(i, { answer: e.target.value || null })} />
            </label>
            <div className="field">
              <span>{app.confirm.mark}</span>
              <MarkToggle value={p.mark} onChange={(mark) => props.onChange(draft.map((d, j) => (j === i ? withParentMark(d, mark) : d)))} />
              {p.markSource && p.markSource !== "parent" && p.mark && (
                <small className="mark-source" data-testid="mark-source" data-source={p.markSource}>
                  {app.confirm.source[p.markSource]}
                </small>
              )}
              {p.correctAnswer && (
                <small className="mark-key" data-testid="ai-answer">
                  {app.confirm.correctAnswer(p.correctAnswer)}
                </small>
              )}
              {judgeDisagrees(p) && (
                <small className="mark-note" data-testid="mark-disagree">
                  {app.confirm.disagree}
                </small>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="sticky-actions">
        <button type="button" className="btn btn-ghost" onClick={props.onCancel}>{app.confirm.cancel}</button>
        <button
          type="button"
          className="btn btn-primary grow"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await props.onSave();
            } finally {
              setSaving(false);
            }
          }}
        >
          {app.confirm.save}
        </button>
      </div>
    </>
  );
  if (!twoCol) return <div className="page" data-step="confirm">{main}</div>;
  return (
    <div className="page confirm-2col" data-step="confirm" data-testid="confirm-2col">
      <aside className="confirm-photo">
        <ZoomPhoto photo={thumb} alt={app.confirm.photo} />
      </aside>
      <div className="confirm-main">{main}</div>
    </div>
  );
}

function MarkToggle({ value, onChange }: { value: Mark; onChange: (m: Mark) => void }) {
  const opts: { v: Mark; label: string; cls: string }[] = [
    { v: "○", label: "○", cls: "ok" },
    { v: "✕", label: "✕", cls: "wrong" },
    { v: null, label: app.confirm.none, cls: "none" },
  ];
  return (
    <div className="seg" role="radiogroup">
      {opts.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`seg-item mark-${o.cls} ${value === o.v ? "is-on" : ""}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
