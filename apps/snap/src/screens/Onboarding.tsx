import { LangSwitch } from "../components/LangSwitch";
import { useEffect, useState } from "react";
import { PilotCodeForm } from "../components/PilotCodeForm";
import { app } from "../copy";
import { GRADES, gradeLabel, type Grade } from "../curriculum";
import { fetchPilotGate, readPilotCode } from "../lib/pilot";

export function Onboarding({ current, onChoose }: { current?: Grade; onChoose: (g: Grade) => void }) {
  const [g, setG] = useState<Grade | null>(current ?? null);
  // First run on a gated server: ask for the 招待コード before the grade.
  const [needCode, setNeedCode] = useState<boolean | null>(current ? false : null);
  useEffect(() => {
    if (current) return;
    let live = true;
    void fetchPilotGate().then((gate) => live && setNeedCode(gate && !readPilotCode()));
    return () => {
      live = false;
    };
  }, [current]);

  if (needCode === null) return <div className="page onboarding" />;
  if (needCode)
    return (
      <div className="page onboarding">
        <h1>{app.pilot.title}</h1>
        <p className="muted">{app.pilot.body}</p>
        <PilotCodeForm onDone={() => setNeedCode(false)} />
      </div>
    );

  return (
    <div className="page onboarding">
      <div className="lang-row">
        <LangSwitch />
      </div>
      <h1>{app.onboarding.title}</h1>
      <p className="muted">{app.onboarding.body}</p>
      <div className="grade-grid" role="radiogroup">
        {GRADES.map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={g === x}
            className={`grade-btn ${g === x ? "is-on" : ""}`}
            onClick={() => setG(x)}
          >
            {gradeLabel(x)}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block" disabled={!g} onClick={() => g && onChoose(g)}>
        {app.onboarding.start}
      </button>
    </div>
  );
}
