import { useRef, useState } from "react";
import { app } from "../copy";
import { toGrade } from "../curriculum";
import { BackupError, backupFileName, makeBackup, needsBackupReminder, parseBackup } from "../lib/backup";
import type { SavedPage } from "../lib/model";
import { importPages } from "../lib/store";
import { readPref, writePref } from "../state";

type Msg = { ok: boolean; text: string } | null;

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : app.backup.date(d.getMonth() + 1, d.getDate());
}

/** ふりかえり: one-file backup (download) and restore (merge by page id). */
export function BackupCard({ pages, onRestored }: { pages: SavedPage[]; onRestored: () => Promise<void> }) {
  const file = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState(() => readPref("last-backup"));
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  function save() {
    try {
      const grade = toGrade(readPref("grade"));
      const blob = new Blob([JSON.stringify(makeBackup(pages, grade))], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const now = new Date().toISOString();
      writePref("last-backup", now);
      setLast(now);
      setMsg(null);
    } catch {
      setMsg({ ok: false, text: app.backup.failed });
    }
  }

  async function restore(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const incoming = parseBackup(await f.text());
      const n = await importPages(incoming);
      await onRestored();
      setMsg({ ok: true, text: n > 0 ? app.backup.restored(n) : app.backup.nothingNew });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof BackupError ? app.backup.invalid : app.backup.failed });
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const lastText = fmtDate(last);
  return (
    <section className="card backup" data-testid="backup">
      <h2>{app.backup.title}</h2>
      <p className="muted small">{app.backup.body}</p>
      <div className="backup-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pages.length === 0}>
          {app.backup.save}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => file.current?.click()} disabled={busy}>
          {app.backup.restore}
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="backup-input"
        onChange={(e) => void restore(e.target.files?.[0])}
      />
      <p className="small backup-last" data-testid="backup-last">{lastText ? app.backup.last(lastText) : app.backup.never}</p>
      {needsBackupReminder(pages.length, last) && <p className="small backup-remind">{app.backup.remind}</p>}
      {msg && (
        <p className={`notice ${msg.ok ? "notice-ok" : "notice-err"}`} role="status" data-testid="backup-msg">
          {msg.text}
        </p>
      )}
    </section>
  );
}
