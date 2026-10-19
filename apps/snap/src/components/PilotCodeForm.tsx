import { useState } from "react";
import { app } from "../copy";
import { readPilotCode, writePilotCode } from "../lib/pilot";

/** Asks for the 招待コード, stores it on this device, then calls onDone. */
export function PilotCodeForm({ onDone, submitLabel, again }: { onDone: () => void; submitLabel?: string; again?: boolean }) {
  const [code, setCode] = useState(() => (again ? "" : readPilotCode()));
  return (
    <form
      className="form"
      data-testid="pilot-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        writePilotCode(code);
        onDone();
      }}
    >
      {again && <p className="notice notice-err" role="alert">{app.snap.pilotAgain}</p>}
      <label className="field">
        <span>{app.pilot.label}</span>
        <input
          className="code-input"
          name="pilot-code"
          value={code}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-primary btn-block" disabled={!code.trim()}>
        {submitLabel ?? app.pilot.submit}
      </button>
    </form>
  );
}
