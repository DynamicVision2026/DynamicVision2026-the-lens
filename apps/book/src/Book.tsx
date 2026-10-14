// The interior, page by page (WO-021 §2). Every problem, number and answer comes from the bundle.
import { renderToStaticMarkup } from 'react-dom/server';
import { LensIcon, timeLabel, type LensCard, type LensOrDirect } from '@lens/scenes';
import { COPY } from './copy';
import { renderFigure, type FigureMoment } from './figure';
import { answerOf, lensName, solvingLens, type BookPlan, type ChapterPlan, type Page, type Problem } from './plan';
import { printColor, printPalette } from './print';
import { qrSvg } from './qr';
import type { BookBundle, BookTokens } from './types';

export interface RenderLog {
  /** Card ids whose figure fell back to the 「図（準備中）」 placeholder, with the reason. */
  placeholders: Map<string, string>;
}

interface Ctx {
  bundle: BookBundle;
  tokens: BookTokens;
  plan: BookPlan;
  log: RenderLog;
  date: string | null;
}

const svg = (html: string, className?: string) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;

function Figure({ ctx, card, moment, size }: { ctx: Ctx; card: LensCard; moment: FigureMoment; size: 'lg' | 'md' | 'sm' | 'xs' }) {
  const fig = renderFigure(card, moment, ctx.tokens);
  if (fig.none) return null;
  if (!fig.svg) {
    ctx.log.placeholders.set(card.id, fig.reason ?? 'no scene');
    return (
      <div className={`fig w-${size}`} data-figure={card.id}>
        <div className="fig-pending">{COPY.figurePending}</div>
      </div>
    );
  }
  return <div className={`fig w-${size}`} data-figure={card.id} dangerouslySetInnerHTML={{ __html: fig.svg }} />;
}

function lensIconSvg(ctx: Ctx, lens: LensOrDirect): string {
  const ink = printColor(ctx.tokens.color.ink);
  const inner = renderToStaticMarkup(<LensIcon lens={lens} tokens={ctx.tokens} color={ink} size={24} />);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28">${inner}</svg>`;
}

function qr(ctx: Ctx, url: string): string {
  const p = printPalette(ctx.tokens);
  return qrSvg(url, p.ink, p.paper);
}

function ProblemText({ card }: { card: LensCard }) {
  return <div className="ptext" data-text={card.id}>{card.problem.text_ja}</div>;
}

function BottomBar({ ctx, ch, card }: { ctx: Ctx; ch: ChapterPlan; card: LensCard }) {
  return (
    <div className="bottom-bar">
      <div className="trigger">
        <span className="k">{COPY.trigger}</span>
        {card.trigger.ja}
      </div>
      {ch.chapter.qr && (
        <div className="qr-wrap">
          {svg(qr(ctx, ch.chapter.qr))}
          <div className="qr-cap">{COPY.qrCaption}</div>
        </div>
      )}
    </div>
  );
}

function TimeStrip({ ctx, seconds, source, trap }: { ctx: Ctx; seconds: number; source: 'estimate' | 'tester_median'; trap: boolean }) {
  const tc = ctx.tokens.time_cost;
  const label = timeLabel(trap ? tc.trap_label_ja : tc.lens_label_ja, seconds);
  return (
    <div className={`time ${trap ? 'trap' : 'lens'}`}>
      <span>{COPY.time}</span>
      <span className="bar" style={{ width: `${Math.min(60, seconds / tc.scale_sec_per_mm)}mm` }} />
      <span className="num">{label}</span>
      <span className="badge-src">{tc.source_badge[source]}</span>
    </div>
  );
}

function Spread({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: 'spread' }> }) {
  const { ch, card, side, exampleNo } = page;
  const trap = side === 'left';
  const route = trap ? card.trap_route : card.lens_route;
  return (
    <div className="body" data-example={card.id}>
      <div className="runhead">
        <span>{COPY.chapter(ch.no)}　{ch.lensName}</span>
        <span>{COPY.example(exampleNo)}</span>
      </div>
      <div className="problem-row">
        <ProblemText card={card} />
        <Figure ctx={ctx} card={card} moment="problem" size={trap ? 'lg' : 'md'} />
      </div>
      {trap ? (
        <>
          <div className="side-head trap-head">
            <span className="trap-mark" />
            <h2>{COPY.trap}</h2>
          </div>
          <ol className="steps trap">
            {route.steps.map((s, i) => (
              <li key={i}>{s.ja}</li>
            ))}
          </ol>
          <TimeStrip ctx={ctx} seconds={route.time_cost_sec} source={route.time_source} trap />
        </>
      ) : (
        <>
          <div className="side-head">
            {svg(lensIconSvg(ctx, ch.chapter.lens))}
            <h2>{COPY.lens}</h2>
            <span className="tag">{ch.lensName}</span>
          </div>
          <div className="solve-row">
            <ol className="steps lens">
              {route.steps.map((s, i) => (
                <li key={i}>
                  <span className="badge">{i + 1}</span>
                  {s.ja}
                </li>
              ))}
            </ol>
            <Figure ctx={ctx} card={card} moment="solved" size="md" />
          </div>
          <TimeStrip ctx={ctx} seconds={route.time_cost_sec} source={route.time_source} trap={false} />
        </>
      )}
      <BottomBar ctx={ctx} ch={ch} card={card} />
    </div>
  );
}

function PracticeProblem({ ctx, p }: { ctx: Ctx; p: Problem }) {
  return (
    <div className="problem" data-problem={p.id}>
      <div className="plabel">
        <span>{p.label}</span>
        {p.variant && <span className="sim">{COPY.similar}</span>}
      </div>
      <div className="problem-row">
        <ProblemText card={p.card} />
        <Figure ctx={ctx} card={p.card} moment="problem" size="sm" />
      </div>
      <div className="which">
        {COPY.whichLens} <span className="box" />
      </div>
      <div className="work" />
    </div>
  );
}

function ReviewItem({ ctx, p }: { ctx: Ctx; p: Problem }) {
  const options = Object.keys(ctx.bundle.labels.lenses);
  return (
    <div className="review-item" data-review={p.id}>
      <div className="plabel">{p.label}</div>
      <div className="problem-row">
        <ProblemText card={p.card} />
        <Figure ctx={ctx} card={p.card} moment="problem" size="xs" />
      </div>
      <div className="ticks">
        {options.map((o) => (
          <span key={o}>
            <i />
            {lensName(ctx.bundle, o)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Answer({ ctx, p }: { ctx: Ctx; p: Problem }) {
  return (
    <div className="ans" data-answer={p.id}>
      <div className="row">
        <span className="lbl">{p.label}</span>
        <span className="val" data-answer-value={p.id}>
          {answerOf(p)}
        </span>
        <span className="lens">
          {COPY.answerLens}：{lensName(ctx.bundle, solvingLens(p.card))}
        </span>
      </div>
      <ol>
        {p.card.lens_route.steps.map((s, i) => (
          <li key={i}>{s.ja}</li>
        ))}
      </ol>
    </div>
  );
}

function PageBody({ ctx, page }: { ctx: Ctx; page: Page }) {
  const { book } = ctx.plan;
  const fm = book.front_matter;
  switch (page.kind) {
    case 'title':
      return (
        <div className="body title-page">
          <div className="series">{book.series_ja}</div>
          <div className="title-rule" />
          <h1 className="book-title">{book.title_ja}</h1>
          <div className="book-subtitle">{book.subtitle_ja}</div>
          <div className="audience">{book.audience_ja}</div>
          <div className="title-foot">
            {book.author_ja}
            <br />
            {book.publisher_ja}
          </div>
        </div>
      );
    case 'hajimeni':
      return (
        <div className="body">
          <h2 className="page-title">{COPY.hajimeni}</h2>
          <div className="prose">
            {fm.hajimeni_ja.split(/\s+/).filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      );
    case 'tsukaikata':
      return (
        <div className="body">
          <h2 className="page-title">{COPY.tsukaikata}</h2>
          <ol className="howto">
            {fm.tsukaikata_ja.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <div className="note">{fm.qr_ja}</div>
          <div className="note">{fm.honesty_ja}</div>
          <div className="note quiet">{fm.parent_ja}</div>
        </div>
      );
    case 'contents':
      return (
        <div className="body">
          <h2 className="page-title">{COPY.contents}</h2>
          <ul className="toc">
            {ctx.plan.toc.map((e) => (
              <li key={e.label}>
                <span>{e.label}</span>
                <span className="lead" />
                <span className="num">{e.page}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'opener': {
      const { ch } = page;
      return (
        <div className="body opener" data-chapter={ch.chapter.lens}>
          <div className="chapter-no">{COPY.chapter(ch.no)}</div>
          {svg(lensIconSvg(ctx, ch.chapter.lens), 'lens-icon')}
          <h1>{ch.lensName}</h1>
          {ch.chapter.principle_ja && (
            <div className="principle">
              <h3>{COPY.principle}</h3>
              <p>{ch.chapter.principle_ja}</p>
            </div>
          )}
          {ch.chapter.qr && (
            <div className="qr-block">
              {svg(qr(ctx, ch.chapter.qr))}
              <div className="cap">{COPY.qrCaption}</div>
            </div>
          )}
        </div>
      );
    }
    case 'spread':
      return <Spread ctx={ctx} page={page} />;
    case 'boundary': {
      const { ch, card } = page;
      const same = card.lens === ch.chapter.lens;
      return (
        <div className="body" data-boundary={card.id}>
          <div className="runhead">
            <span>{COPY.chapter(ch.no)}　{ch.lensName}</span>
          </div>
          <div className="boundary-head">
            <h2>{same ? COPY.boundarySame : COPY.boundaryOther}</h2>
            {!same && <span className="other">{lensName(ctx.bundle, solvingLens(card))}</span>}
          </div>
          <div className="problem-row">
            <ProblemText card={card} />
            <Figure ctx={ctx} card={card} moment="problem" size="lg" />
          </div>
          {ch.chapter.boundary_line && (
            <div className="boundary-line">
              <div className="k">{COPY.boundaryLine}</div>
              <p>{ch.chapter.boundary_line}</p>
            </div>
          )}
        </div>
      );
    }
    case 'practice':
      return (
        <div className="body">
          <div className="runhead">
            <span>{COPY.chapter(page.ch.no)}　{page.ch.lensName}</span>
            <span>{COPY.practice}</span>
          </div>
          {page.first && (
            <div className="section-head">
              <h2>{COPY.practice}</h2>
            </div>
          )}
          <div className="problems">
            {page.items.map((p) => (
              <PracticeProblem key={p.id} ctx={ctx} p={p} />
            ))}
          </div>
        </div>
      );
    case 'review':
      return (
        <div className="body">
          <div className="runhead">
            <span>{COPY.review}</span>
          </div>
          {page.first && (
            <div className="section-head">
              <h2>{COPY.review}</h2>
              <span className="lead">{COPY.reviewLead}</span>
            </div>
          )}
          <div className="problems">
            {page.items.map((p) => (
              <ReviewItem key={p.id} ctx={ctx} p={p} />
            ))}
          </div>
        </div>
      );
    case 'answers':
      return (
        <div className="body">
          <div className="runhead">
            <span>{COPY.answers}</span>
          </div>
          {page.first && (
            <div className="section-head">
              <h2>{COPY.answers}</h2>
            </div>
          )}
          <div className="answers">
            {page.items.map((p) => (
              <Answer key={p.id} ctx={ctx} p={p} />
            ))}
          </div>
        </div>
      );
    case 'memo':
      return (
        <div className="body memo-page">
          <h3>{COPY.memo}</h3>
          <div className="rule" />
        </div>
      );
    case 'colophon':
      return (
        <div className="body colophon">
          <div className="box">
            <div className="t">{book.title_ja}</div>
            <div>{book.subtitle_ja}</div>
            <dl>
              <dt>{COPY.published}</dt>
              <dd className="num">{ctx.date ?? COPY.draftDate}</dd>
              <dt>{COPY.author}</dt>
              <dd>{book.author_ja}</dd>
              <dt>{COPY.publisher}</dt>
              <dd>{book.publisher_ja}</dd>
            </dl>
            <div>{COPY.copyright}</div>
          </div>
        </div>
      );
  }
}

export function Interior({ ctx }: { ctx: Ctx }) {
  return (
    <>
      {ctx.plan.pages.map((page, i) => {
        const n = i + 1;
        const side = n % 2 === 1 ? 'recto' : 'verso';
        const showFolio = page.kind !== 'title' && page.kind !== 'colophon';
        return (
          <section key={n} className={`page ${side} p-${page.kind}`} data-page={n} data-kind={page.kind}>
            <PageBody ctx={ctx} page={page} />
            {showFolio && <div className="folio">{n}</div>}
          </section>
        );
      })}
    </>
  );
}

export type { Ctx as BookContext };
