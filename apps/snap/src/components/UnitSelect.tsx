import { type Grade, previousGrade, unitById, unitsForGrade } from "../curriculum";
import { app } from "../copy";

/**
 * Unit dropdown: the grade's units, then the previous grade's. `suggest` (the reader's second-best
 * unit) is offered first in a 「候補」 group when it is set and differs from the current value.
 */
export function UnitSelect(props: {
  grade: Grade;
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
  suggest?: string | null;
}) {
  const prev = previousGrade(props.grade);
  const alt = props.suggest && props.suggest !== props.value ? unitById(props.suggest) : undefined;
  return (
    <select
      id={props.id}
      className={`select ${props.value ? "" : "select-empty"}`}
      value={props.value ?? ""}
      onChange={(e) => props.onChange(e.target.value || null)}
    >
      <option value="">{app.confirm.noUnit}</option>
      {alt && (
        <optgroup label={app.confirm.unitSuggest}>
          <option value={alt.id}>
            {alt.appGrade} {alt.label}
          </option>
        </optgroup>
      )}
      <optgroup label={props.grade}>
        {unitsForGrade(props.grade).map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </optgroup>
      {prev && (
        <optgroup label={prev}>
          {unitsForGrade(prev).map((u) => (
            <option key={u.id} value={u.id}>
              {prev} {u.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
