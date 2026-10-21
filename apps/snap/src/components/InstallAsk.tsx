import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { app } from "../copy";
import { useInstallAsk } from "../lib/pwa";

const t = app.install;

/**
 * The home-screen reminder: a window on the map a moment after a saved photo has lit up its unit
 * (1st photo; once more after the next one if they chose 「あとで」). Not shown when the app already
 * runs from the home screen.
 */
export function InstallAsk() {
  const { mode, yes, later, close } = useInstallAsk();
  const onMap = useLocation().pathname === "/app/map";
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!onMap || mode !== "ask") return;
    const id = window.setTimeout(() => setReady(true), 2500); // let the new unit light up first
    return () => window.clearTimeout(id);
  }, [onMap, mode]);
  if (!mode || (mode === "ask" && !(onMap && ready))) return null;
  const steps = mode === "ios" ? t.ios : mode === "android" ? t.android : null;
  return (
    <div className="install-ask-backdrop">
      <section className="install-ask" role="dialog" aria-modal="true" aria-labelledby="install-ask-title" data-testid="install-ask" data-mode={mode}>
        <img className="install-icon" src="/icons/icon-192.png" alt="" width={56} height={56} />
        <h2 id="install-ask-title">{steps ? t.stepsTitle : t.title}</h2>
        {steps ? (
          <ol className="install-steps">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <p>{t.body}</p>
        )}
        {steps ? (
          <button type="button" className="btn btn-primary btn-block" onClick={close}>
            {t.done}
          </button>
        ) : (
          <div className="install-ask-actions">
            <button type="button" className="btn btn-ghost" onClick={later}>
              {t.later}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void yes()}>
              {t.yes}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
