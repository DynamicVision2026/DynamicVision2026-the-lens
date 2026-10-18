import { Link } from "react-router-dom";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import { type Tile, mapTiles, unfiled } from "../lib/review";
import { usePages } from "../state";

export function MapScreen({ grade }: { grade: Grade }) {
  const { pages } = usePages();
  if (!pages) return <div className="page" />;
  const { own, other } = mapTiles(pages, grade);
  const nUnfiled = unfiled(pages);
  return (
    <div className="page">
      <h1>{app.map.title}</h1>
      <p className="muted">{app.map.body}</p>
      <div className="legend">
        <span><i className="dot dot-review" />{app.map.legend.review}</span>
        <span><i className="dot dot-ok" />{app.map.legend.ok}</span>
        <span><i className="dot dot-empty" />{app.map.legend.empty}</span>
      </div>
      {nUnfiled > 0 && <p className="notice notice-warn">{app.map.unfiled(nUnfiled)}</p>}
      <Tiles tiles={own} />
      {other.length > 0 && (
        <>
          <h2 className="h-sub">{app.map.other}</h2>
          <Tiles tiles={other} showGrade />
        </>
      )}
    </div>
  );
}

function Tiles({ tiles, showGrade }: { tiles: Tile[]; showGrade?: boolean }) {
  return (
    <ul className="tiles">
      {tiles.map((t) => (
        <li key={t.unit.id}>
          <Link to={`/app/list?unit=${encodeURIComponent(t.unit.id)}`} className={`tile tile-${t.status}`} data-unit={t.unit.id}>
            <span className="tile-code">{showGrade ? `${t.unit.grade} ` : ""}{t.unit.unit}</span>
            <span className="tile-topic">{t.unit.topic}</span>
            <span className="tile-stats">
              {t.count > 0 ? app.map.problems(t.count) : "—"}
              {t.wrong > 0 && <b className="tile-wrong">{app.map.wrong(t.wrong)}</b>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
