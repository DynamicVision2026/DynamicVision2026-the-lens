import { app } from "../copy";

/** The YouTube play mark (red rounded rectangle, white triangle), drawn from tokens. */
export function YouTubeGlyph() {
  return (
    <svg className="yt-glyph" viewBox="0 0 24 17" width="20" height="14" aria-hidden focusable="false">
      <rect x="0.5" y="0.5" width="23" height="16" rx="4.5" />
      <path d="M9.6 4.6v7.8l6.6-3.9z" />
    </svg>
  );
}

/** 「解説動画（YouTube）」: one link (new tab / the YouTube app) + 「動画がまだない単元もあります」. */
export function VideoLink({ href, label, testid }: { href: string; label: string; testid: string }) {
  return (
    <div className="yt-row">
      <a className="yt-btn" href={href} target="_blank" rel="noopener" aria-label={label} data-testid={testid}>
        <YouTubeGlyph />
        {app.video.button}
      </a>
      <small className="yt-note">{app.video.note}</small>
    </div>
  );
}
