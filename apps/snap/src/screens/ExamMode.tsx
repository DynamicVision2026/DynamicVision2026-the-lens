import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PhotoThumb } from "../components/PhotoThumb";
import { VideoLink } from "../components/VideoLink";
import { useSheetDrag } from "../components/useSheetDrag";
import { app, MISC } from "../copy";
import { unitById } from "../curriculum";
import {
  type ExamPlan,
  type PlanGroup,
  type PlanItem,
  addDays,
  dayParts,
  examDay,
  isDay,
  isoDay,
  missingLine,
  rangeLine,
  rootLabel,
  shareText,
  summaryRows,
  unitName,
  whenTitle,
} from "../lib/examplan";
import { channelUrl } from "../lib/youtube";

/**
 * テスト前モード on the map (the map stays the surface): the date question, the range bar under the dimmed
 * map, 今夜の作戦 (a sheet with the unit sheet's mechanics) and the one-screen parent summary.
 */

const e = app.exam;

/** Step 1: 「テストはいつですか？」 明日 / あさって / 日付を選ぶ. */
export function ExamDate({ now, initial, onPick, onClose }: { now: Date; initial: string | null; onPick: (day: string) => void; onClose: () => void }) {
  const [picking, setPicking] = useState(false);
  const today = isoDay(now);
  const [day, setDay] = useState(initial && initial >= today ? initial : addDays(today, 3));
  const choice = (c: "tomorrow" | "dayAfter") => {
    const d = examDay(c, now);
    const { md, wd } = dayParts(d);
    return { d, label: c === "tomorrow" ? e.tomorrow : e.dayAfter, sub: e.dayChoice(md, wd) };
  };
  return (
    <section className="sheet terr-sheet exam-date" role="dialog" aria-modal="false" aria-labelledby="exam-when" data-testid="exam-date">
      <div className="sheet-top">
        <span className="exam-kicker">{e.mode}</span>
        <button type="button" className="sheet-close" onClick={onClose} aria-label={e.close} data-testid="exam-close">
          ×
        </button>
      </div>
      <h2 id="exam-when" className="exam-q">
        {e.when}
      </h2>
      <p className="exam-note">{e.whenNote}</p>
      <div className="exam-days">
        {(["tomorrow", "dayAfter"] as const).map((c) => {
          const ch = choice(c);
          return (
            <button key={c} type="button" className="exam-day" onClick={() => onPick(ch.d)} data-testid={`exam-${c}`} data-day={ch.d}>
              <b>{ch.label}</b>
              <span>{ch.sub}</span>
            </button>
          );
        })}
        <button type="button" className={`exam-day exam-day-pick${picking ? " is-on" : ""}`} aria-expanded={picking} onClick={() => setPicking((p) => !p)} data-testid="exam-pick">
          <b>{e.pick}</b>
        </button>
      </div>
      {picking && (
        <div className="exam-pickrow">
          <label className="sr-only" htmlFor="exam-day-input">
            {e.pickLabel}
          </label>
          <input
            id="exam-day-input"
            type="date"
            min={today}
            value={day}
            onChange={(ev) => setDay(ev.target.value)}
            data-testid="exam-day-input"
          />
          <button type="button" className="btn btn-primary exam-pick-ok" disabled={!isDay(day) || day < today} onClick={() => onPick(day)} data-testid="exam-pick-ok">
            {e.pickOk}
          </button>
        </div>
      )}
    </section>
  );
}

/** Step 2: the bottom bar while the student taps unit tiles on the dimmed map. */
export function RangeBar({ range, onDecide, onClose }: { range: string[]; onDecide: () => void; onClose: () => void }) {
  const units = range.map((id) => unitById(id)).filter((u) => !!u);
  return (
    <>
      <div className="exam-banner" role="status" data-testid="exam-range-ask">
        <b>{e.rangeAsk}</b>
        <span>{e.rangeHint}</span>
      </div>
      <section className="exam-rangebar" aria-label={e.rangeAsk} data-testid="exam-rangebar">
        <div className="erb-text">
          <b data-testid="exam-range-count">{e.rangeCount(units.length)}</b>
          <span className="erb-names">{units.length ? rangeLine(units) : e.rangeNone}</span>
        </div>
        <button type="button" className="erb-cancel" onClick={onClose} aria-label={e.close}>
          ×
        </button>
        <button type="button" className="btn erb-ok" disabled={units.length === 0} onClick={onDecide} data-testid="exam-decide">
          {e.decide}
        </button>
      </section>
    </>
  );
}

/** 今夜の作戦: header (when · range, plan line, progress), ① ② ③, missing units, completion. */
export function PlanSheet(props: {
  plan: ExamPlan;
  day: string;
  now: Date;
  hidden: boolean;
  onClose: () => void;
  onTick: (item: PlanItem, checked: boolean) => void;
  onOpenPage: (item: PlanItem) => void;
  onShare: () => void;
  onChange: () => void;
  focusUnit: string | null;
}) {
  const { plan, day, now } = props;
  const sheet = useSheetDrag(props.onClose);
  const body = useRef<HTMLDivElement>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  // a tile tapped on the map while the plan is open: its group at the top of the body
  useEffect(() => {
    if (!props.focusUnit) return;
    const el = body.current?.querySelector<HTMLElement>(`[data-group="${CSS.escape(props.focusUnit)}"]`);
    if (el && body.current) body.current.scrollTo({ top: Math.max(0, el.offsetTop - 4), behavior: "smooth" });
  }, [props.focusUnit]);
  const miss = missingLine(plan);
  const pct = plan.total ? (plan.done / plan.total) * 100 : 0;
  /** An overview row: its section at the top of the body (③ opens). */
  const jump = (section: "first" | "roots" | "extra") => {
    if (section === "extra") setExtraOpen(true);
    requestAnimationFrame(() => {
      const el = body.current?.querySelector<HTMLElement>(`[data-testid="plan-${section}"]`);
      if (el && body.current) body.current.scrollTo({ top: Math.max(0, el.offsetTop - 4), behavior: "smooth" });
    });
  };
  return (
    <section
      ref={sheet.ref}
      className={`sheet terr-sheet unit-sheet plan-sheet${sheet.full ? " is-full" : ""}${sheet.dragging ? " is-drag" : ""}`}
      style={sheet.style}
      role="dialog"
      aria-modal="false"
      aria-labelledby="plan-title"
      aria-hidden={props.hidden || undefined}
      inert={props.hidden || undefined}
      data-testid="exam-plan"
      data-size={sheet.full ? "full" : "half"}
    >
      <div className="sheet-head plan-head" {...sheet.headProps}>
        <button
          type="button"
          className="sheet-grab"
          aria-label={sheet.full ? app.map.sheet.shrink : app.map.sheet.grow}
          aria-expanded={sheet.full}
          onClick={() => sheet.setFull((f) => !f)}
          data-testid="plan-grab"
        />
        <div className="sheet-top">
          <span className="exam-kicker">{e.plan}</span>
          <button type="button" className="plan-share" onClick={props.onShare} data-testid="plan-share">
            {e.share}
          </button>
          <button type="button" className="sheet-close" onClick={props.onClose} aria-label={e.close} data-testid="plan-close">
            ×
          </button>
        </div>
        <h2 id="plan-title" className="plan-title" data-testid="plan-title">
          {whenTitle(day, now)}
          <span className="plan-dot" aria-hidden>
            ・
          </span>
          {e.rangeUnits(plan.range.length)}
        </h2>
        <p className="plan-line" data-testid="plan-line">
          {plan.total > 0 ? e.tonight(plan.total, plan.minutes) : e.tonightNone}
        </p>
        {plan.total > 0 && (
          <div className="plan-progress" data-testid="plan-progress">
            <span className="plan-bar" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="plan-count" data-testid="plan-count">
              {e.progress(plan.done, plan.total)}
            </span>
          </div>
        )}
        <VideoLink href={channelUrl()} label={app.video.channelLabel} testid="plan-youtube" />
      </div>
      <div ref={body} className="sheet-body plan-body" data-testid="plan-body">
        {miss && (
          <div className="plan-missing" data-testid="plan-missing">
            <p>
              <b>{miss}</b>
              <span>{e.missingNote}</span>
            </p>
            <Link to="/app/snap" className="plan-snap" data-testid="plan-snap">
              {e.snap}
            </Link>
          </div>
        )}
        {plan.complete && (
          <div className="plan-done" role="status" data-testid="plan-done">
            <b>{e.doneTitle}</b>
            <span>{e.doneBody}</span>
            {plan.extra.length > 0 && <span>{e.doneExtra(plan.extra.length)}</span>}
          </div>
        )}
        <Overview plan={plan} onJump={jump} />
        {plan.total === 0 && <p className="sheet-none" data-testid="plan-nothing">{plan.missing.length === plan.range.length ? e.noData : e.nothing}</p>}
        {plan.first.length > 0 && (
          <PlanSection n="①" title={e.first} note={e.firstNote} count={plan.first.reduce((s, g) => s + g.items.length, 0)} testid="plan-first">
            {plan.first.map((g) => (
              <Group key={g.unit.id} g={g} label={unitName(g.unit)} onTick={props.onTick} onOpenPage={props.onOpenPage} />
            ))}
          </PlanSection>
        )}
        {plan.roots.length > 0 && (
          <PlanSection n="②" title={e.roots} note={e.rootsNote} count={plan.roots.reduce((s, g) => s + g.items.length, 0)} testid="plan-roots">
            {plan.roots.map((g) => (
              <Group key={g.unit.id} g={g} label={rootLabel(g)} onTick={props.onTick} onOpenPage={props.onOpenPage} />
            ))}
          </PlanSection>
        )}
        {plan.extra.length > 0 && (
          <section className={`plan-sec plan-extra${extraOpen ? " is-open" : ""}`} data-testid="plan-extra">
            <h3 className="plan-sec-h">
              <button type="button" className="plan-extra-btn" aria-expanded={extraOpen} onClick={() => setExtraOpen((o) => !o)} data-testid="plan-extra-toggle">
                <span className="plan-n">③</span>
                {e.extra}
                <span className="plan-sec-count">{e.count(plan.extra.length)}</span>
                <span className="plan-chev" aria-hidden>
                  {extraOpen ? "▴" : "▾"}
                </span>
              </button>
            </h3>
            {extraOpen && (
              <>
                <p className="plan-sec-note">{e.extraNote}</p>
                <ol className="unit-probs">
                  {plan.extra.map((it) => (
                    <PlanCard key={it.key} it={it} showUnit onTick={props.onTick} onOpenPage={props.onOpenPage} />
                  ))}
                </ol>
              </>
            )}
          </section>
        )}
        <div className="sheet-foot plan-foot">
          <button type="button" className="link-btn sheet-link" onClick={props.onChange} data-testid="plan-change">
            {e.changeRange}
          </button>
        </div>
      </div>
    </section>
  );
}

/** ①②③ at a glance (top of the body): what tonight holds, each row jumps to its section. */
function Overview({ plan, onJump }: { plan: ExamPlan; onJump: (s: "first" | "roots" | "extra") => void }) {
  const rows: { s: "first" | "roots" | "extra"; n: string; title: string; units: string; count: number; left: number }[] = [];
  const add = (s: "first" | "roots" | "extra", n: string, title: string, units: string, items: PlanItem[]) =>
    items.length && rows.push({ s, n, title, units, count: items.length, left: items.filter((i) => !i.problem.reviewed).length });
  add("first", "①", e.first, plan.first.map((g) => unitName(g.unit)).join("・"), plan.first.flatMap((g) => g.items));
  add("roots", "②", e.roots, plan.roots.map((g) => rootLabel(g)).join("、"), plan.roots.flatMap((g) => g.items));
  add("extra", "③", e.extra, [...new Set(plan.extra.map((i) => unitName(i.unit)))].join("・"), plan.extra);
  if (rows.length === 0) return null;
  return (
    <ol className="plan-ov" aria-label={e.overview} data-testid="plan-overview">
      {rows.map((r) => (
        <li key={r.s}>
          <button type="button" className={`ov-row ov-${r.s}${r.s !== "extra" && r.left === 0 ? " is-done" : ""}`} onClick={() => onJump(r.s)} data-testid="overview-row">
            <span className="ov-n">{r.n}</span>
            <span className="ov-main">
              <b>{r.title}</b>
              <small>{r.units}</small>
            </span>
            <span className="ov-count">{r.s !== "extra" && r.left === 0 ? e.overviewDone : e.count(r.count)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function PlanSection(props: { n: string; title: string; note: string; count: number; testid: string; children: React.ReactNode }) {
  return (
    <section className="plan-sec" data-testid={props.testid}>
      <h3 className="plan-sec-h">
        <span className="plan-n">{props.n}</span>
        {props.title}
        <span className="plan-sec-count">{e.count(props.count)}</span>
      </h3>
      <p className="plan-sec-note">{props.note}</p>
      {props.children}
    </section>
  );
}

function Group({ g, label, onTick, onOpenPage }: { g: PlanGroup; label: string; onTick: (it: PlanItem, c: boolean) => void; onOpenPage: (it: PlanItem) => void }) {
  const left = g.items.filter((i) => !i.problem.reviewed).length;
  return (
    <div className="plan-group" data-group={g.unit.id} data-testid="plan-group">
      <h4 className="plan-group-h">
        <span>{label}</span>
        <span className={`plan-group-n${left === 0 ? " is-done" : ""}`}>{left === 0 ? e.reviewed : app.map.wrong(left)}</span>
      </h4>
      <ol className="unit-probs">
        {g.items.map((it) => (
          <PlanCard key={it.key} it={it} onTick={onTick} onOpenPage={onOpenPage} />
        ))}
      </ol>
    </div>
  );
}

/** One problem: re-solve first (the AI's answer hidden behind 「答えを確かめる」), then 「復習した」. */
export function PlanCard({ it, showUnit, onTick, onOpenPage }: { it: PlanItem; showUnit?: boolean; onTick: (it: PlanItem, c: boolean) => void; onOpenPage: (it: PlanItem) => void }) {
  const s = app.map.sheet;
  const pr = it.problem;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [long, setLong] = useState(false);
  const q = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = q.current;
    if (!el || open) return;
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [pr.q, open]);
  const mk = it.mark === "✕" ? "x" : it.mark === "○" ? "o" : "none";
  return (
    <li className={`up plan-card${pr.reviewed ? " is-done" : ""}`} data-testid="plan-card" data-key={it.key} data-unit={it.unit.id} data-mark={mk}>
      <div className="up-main">
        <div className="up-meta">
          <span className="up-when">
            {it.date} {it.type}
          </span>
          <span>{s.problemNo(pr.n)}</span>
          {showUnit && <span className="plan-card-unit">{unitName(it.unit)}</span>}
        </div>
        <p ref={q} className={`up-q${open ? " is-open" : ""}`}>
          {pr.q}
        </p>
        {long && (
          <button type="button" className="up-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? s.less : s.more}
          </button>
        )}
        <p className="up-a">
          {s.yourAnswer}{MISC.colon}<span className="up-ans">{pr.answer || s.blank}</span>
        </p>
        <div className="up-mark">
          <span className={`pv-mark mk-${mk}`}>{it.mark ?? "—"}</span>
          <span className="up-src">{it.sourceLabel || s.noMark}</span>
          {it.reason === "low" && <span className="pill pill-warn">{s.low}</span>}
        </div>
        {pr.correctAnswer ? (
          shown ? (
            <p className="plan-answer" data-testid="plan-answer">
              <span>{app.confirm.correctAnswer(pr.correctAnswer)}</span>
              <button type="button" className="link-btn plan-hide" onClick={() => setShown(false)}>
                {e.checkHide}
              </button>
            </p>
          ) : (
            <button type="button" className="plan-check" onClick={() => setShown(true)} aria-describedby={`chk-${it.key}`} data-testid="plan-check">
              {e.check}
              <span id={`chk-${it.key}`} className="sr-only">
                {e.checkFirst}
              </span>
            </button>
          )
        ) : (
          <p className="plan-noanswer">{e.noAnswer(!!it.page.photo)}</p>
        )}
        <label className="check up-check plan-tick">
          <input type="checkbox" checked={pr.reviewed} onChange={(ev) => onTick(it, ev.target.checked)} data-testid="plan-tick" />
          <span>{e.reviewed}</span>
        </label>
      </div>
      {it.page.photo ? (
        <PhotoThumb photo={it.page.photo} alt={s.photoOpen(it.date, it.type, pr.n)} onOpen={() => onOpenPage(it)} />
      ) : (
        <button type="button" className="thumb thumb-none" onClick={() => onOpenPage(it)} aria-label={s.photoOpen(it.date, it.type, pr.n)} data-testid="photo-thumb">
          {s.noPhoto}
        </button>
      )}
    </li>
  );
}

/** The parent summary: one clean screen (screenshot it, or share the same lines as text). */
export function ExamSummary({ plan, day, now, onClose }: { plan: ExamPlan; day: string; now: Date; onClose: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const rows = summaryRows(plan);
  const miss = missingLine(plan);
  const sec = { first: `① ${e.first}`, roots: `② ${e.roots}`, extra: `③ ${e.extra}` };
  const share = async () => {
    const text = shareText(plan, day, now);
    try {
      if (navigator.share) {
        await navigator.share({ title: e.summary, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setStatus(e.copied);
    } catch (err) {
      // the share sheet closed by the person is not an error
      if ((err as Error)?.name !== "AbortError") setStatus(e.shareFailed);
    }
  };
  const pct = plan.total ? (plan.done / plan.total) * 100 : 0;
  return (
    <div className="exam-sum" role="dialog" aria-modal="true" aria-labelledby="sum-title" data-testid="exam-summary">
      <div className="sum-top">
        <button type="button" className="pv-close sum-close" onClick={onClose} aria-label={e.summaryClose} autoFocus data-testid="summary-close">
          ×
        </button>
      </div>
      <article className="sum-card">
        <p className="sum-kicker">{e.summary}</p>
        <h2 id="sum-title" className="sum-when" data-testid="summary-when">
          {e.summaryWhen(whenTitle(day, now), dayParts(day).md)}
        </h2>
        <dl className="sum-dl">
          <dt>{e.summaryRange}</dt>
          <dd data-testid="summary-range">{rangeLine(plan.range)}</dd>
        </dl>
        <p className="sum-tonight" data-testid="summary-tonight">
          {plan.total > 0 ? e.tonight(plan.total, plan.minutes) : e.tonightNone}
        </p>
        {rows.length > 0 && (
          <ul className="sum-rows" data-testid="summary-rows">
            {rows.map((r) => (
              <li key={`${r.section}-${r.label}`} className={`sum-row sum-${r.section}${r.done === r.count ? " is-done" : ""}`}>
                <span className="sum-sec">{sec[r.section]}</span>
                <span className="sum-label">{r.label}</span>
                <span className="sum-n">{r.done === r.count ? e.rowDone(r.count) : e.count(r.count)}</span>
              </li>
            ))}
          </ul>
        )}
        {plan.total > 0 && (
          <div className="sum-progress">
            <span className="sum-pl">{e.summaryProgress}</span>
            <span className="plan-bar" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </span>
            <b data-testid="summary-progress">{e.progress(plan.done, plan.total)}</b>
          </div>
        )}
        {plan.complete && <p className="sum-done">{e.doneTitle}</p>}
        {miss && <p className="sum-miss">{miss}</p>}
        <p className="sum-sign">{e.signature}</p>
      </article>
      <div className="sum-actions">
        <button type="button" className="btn btn-primary sum-share" onClick={share} data-testid="summary-share">
          {e.shareText}
        </button>
        {status && (
          <p className="sum-status" role="status" data-testid="summary-status">
            {status}
          </p>
        )}
        <p className="sum-note">{e.summaryNote}</p>
      </div>
    </div>
  );
}
