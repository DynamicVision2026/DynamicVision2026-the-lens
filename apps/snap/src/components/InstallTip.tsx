import { app } from "../copy";
import { useInstallTip } from "../lib/pwa";

/** Shown after the first 保存 until dismissed (never when already running from the home screen). */
export function InstallTip() {
  const { kind, install, dismiss } = useInstallTip();
  if (!kind) return null;
  return (
    <aside className="install-tip" data-testid="install-tip" aria-label={app.install.title}>
      <img className="install-icon" src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="grow">
        <strong>{app.install.title}</strong>
        <p>{kind === "ios" ? app.install.ios : app.install.android}</p>
        <div className="row gap wrap">
          {kind === "prompt" && (
            <button type="button" className="btn btn-primary" onClick={() => void install()}>
              {app.install.add}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={dismiss}>
            {app.install.dismiss}
          </button>
        </div>
      </div>
    </aside>
  );
}
