import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PilotCodeForm } from "../components/PilotCodeForm";
import { UnitSelect } from "../components/UnitSelect";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import { preparePhoto } from "../lib/image";
import { type DraftProblem, type SavedPage, draftFromResult, pageFromDraft } from "../lib/model";
import { type ReadFailure, clearPilotCode, readFailure, readPilotCode } from "../lib/pilot";
import { LOW_CONFIDENCE, litMapUrl } from "../lib/review";
import { savePage } from "../lib/store";
import { type Mark, type PageResult, PageResultSchema } from "../reader/schema";

type State =
  | { s: "idle" }
  | { s: "reading" }
  | { s: "error"; why: Exclude<ReadFailure, "pilot_code"> }
  | { s: "pilot" }
  | { s: "retake"; result: PageResult; thumb?: SavedPage["photo"] }
  | { s: "confirm"; result: PageResult; draft: DraftProblem[]; thumb?: SavedPage["photo"] };

export function Snap({ grade }: { grade: Grade }) {
  const [st, setSt] = useState<State>({ s: "idle" });
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null); // re-sent after a new 招待コード
  const nav = useNavigate();

  async function onFile(file: File | undefined | null) {
    if (!file) return;
    lastFile.current = file;
    setSt({ s: "reading" });
    try {
      const { upload, thumb } = await preparePhoto(file);
      const fd = new FormData();
      fd.append("grade", grade);
      fd.append("image", upload, file.name || "photo.jpg");
      const code = readPilotCode();
      const r = await fetch("/api/read", { method: "POST", body: fd, headers: code ? { "x-pilot-code": code } : {} });
      if (!r.ok) {
        const why = readFailure(r.status, await r.json().catch(() => null));
        if (why === "pilot_code") {
          clearPilotCode();
          setSt({ s: "pilot" });
        } else setSt({ s: "error", why });
        return;
      }
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
          // Straight to the map: the units this page went into light up.
          nav(litMapUrl(page));
        }}
      />
    );

  return (
    <div className="page">
      {inputs}
      <h1>{app.snap.title}</h1>
      <p className="muted">{app.snap.body}</p>

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
          {st.why === "rate_limited" ? app.snap.rateLimited : st.why === "daily_cap" ? app.snap.dailyCap : app.snap.error}
        </p>
      )}
      {st.s === "pilot" && (
        <div className="card">
          <PilotCodeForm again submitLabel={app.pilot.retry} onDone={() => void onFile(lastFile.current)} />
        </div>
      )}

      {st.s === "pilot" ? null : st.s === "reading" ? (
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
  const { result, draft } = props.state;
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<DraftProblem>) =>
    props.onChange(draft.map((p, j) => (j === i ? { ...p, ...patch, edited: true } : p)));

  return (
    <div className="page">
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
            </div>
            <p className="problem-q">{p.q}</p>
            <label className="field">
              <span>{app.confirm.unit}</span>
              <UnitSelect grade={props.grade} value={p.unit} onChange={(unit) => set(i, { unit })} />
            </label>
            <label className="field">
              <span>{app.confirm.answer}</span>
              <input value={p.answer ?? ""} placeholder={app.confirm.noAnswer} onChange={(e) => set(i, { answer: e.target.value || null })} />
            </label>
            <div className="field">
              <span>{app.confirm.mark}</span>
              <MarkToggle value={p.mark} onChange={(mark) => set(i, { mark })} />
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
