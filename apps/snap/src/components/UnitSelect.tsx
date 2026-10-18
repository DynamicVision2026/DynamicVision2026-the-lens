import { type Grade, previousGrade, unitsForGrade } from "../curriculum";
import { app } from "../copy";

export function UnitSelect(props: { grade: Grade; value: string | null; onChange: (id: string | null) => void; id?: string }) {
  const prev = previousGrade(props.grade);
  return (
    <select
      id={props.id}
      className={`select ${props.value ? "" : "select-empty"}`}
      value={props.value ?? ""}
      onChange={(e) => props.onChange(e.target.value || null)}
    >
      <option value="">{app.confirm.noUnit}</option>
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
