import { useState } from "react";
import { app } from "../copy";
import { GRADES, type Grade } from "../curriculum";

export function Onboarding({ current, onChoose }: { current?: Grade; onChoose: (g: Grade) => void }) {
  const [g, setG] = useState<Grade | null>(current ?? null);
  return (
    <div className="page onboarding">
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
            {x}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block" disabled={!g} onClick={() => g && onChoose(g)}>
        {app.onboarding.start}
      </button>
    </div>
  );
}
