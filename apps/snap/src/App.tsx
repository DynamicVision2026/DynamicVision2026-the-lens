import type { ReactElement } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { app } from "./copy";
import type { Grade } from "./curriculum";
import { CameraGlyph } from "./components/SnapFab";
import { APP_TABS, type TabKey, activeTab, homePath } from "./lib/home";
import { Archive } from "./screens/Archive";
import { Landing } from "./screens/Landing";
import { MapScreen } from "./screens/MapScreen";
import { Onboarding } from "./screens/Onboarding";
import { Privacy } from "./screens/Privacy";
import { Report } from "./screens/Report";
import { Snap } from "./screens/Snap";
import { TestList } from "./screens/TestList";
import { useGrade } from "./state";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/app/*" element={<AppArea />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppArea() {
  const [grade, setGrade, gradeCheck, dismissGradeCheck] = useGrade();
  const nav = useNavigate();
  const choose = (g: Grade) => {
    setGrade(g);
    nav("/app", { replace: true });
  };
  if (!grade) return <Onboarding onChoose={choose} />;
  return (
    <div className="shell">
      <header className="topbar">
        <a href="/" className="brand">Lens Snap</a>
        <NavLink to="/app/grade" className={`grade-chip${gradeCheck ? " is-check" : ""}`} aria-label={app.grade.change} data-testid="grade-chip">
          {grade}
        </NavLink>
      </header>
      {gradeCheck && (
        <div className="grade-check" role="status" data-testid="grade-check">
          <span>{app.grade.migrated(grade)}</span>
          <button type="button" className="link-btn" onClick={dismissGradeCheck}>
            {app.grade.ok}
          </button>
        </div>
      )}
      <main className="main">
        <Routes>
          <Route path="grade" element={<Onboarding current={grade} onChoose={choose} />} />
          <Route index element={<Home />} />
          <Route path="snap" element={<Snap grade={grade} />} />
          <Route path="report" element={<Report grade={grade} />} />
          <Route path="map" element={<MapScreen grade={grade} />} />
          <Route path="list" element={<TestList grade={grade} />} />
          <Route path="archive" element={<Archive />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

/** App home: always the 単元マップ (before the first page it shows the empty sky + a welcome card). */
function Home() {
  return <Navigate to={homePath()} replace />;
}

type IconName = TabKey;

/** Tab icons: 24 px line drawings in currentColor (no colour of their own). */
const ICONS: Record<IconName, ReactElement> = {
  snap: <CameraGlyph />,
  map: <path d="M12 3.5l2.3 5.6 5.7.4-4.4 3.7 1.4 5.8L12 15.9 7 19l1.4-5.8L4 9.5l5.7-.4z" />,
  list: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.5l2.8 2.8L16 9.5" />
    </>
  ),
  archive: <path d="M5 6h14M5 12h14M5 18h9" />,
};

/** Four tabs, マップ first; the 学習レポート (the map's 「詳しく」 page) keeps マップ lit. */
function TabBar() {
  const on = activeTab(useLocation().pathname);
  return (
    <nav className="tabbar">
      {APP_TABS.map((t) => (
        <Link key={t.key} to={t.to} className={`tab ${on === t.key ? "tab-active" : ""}`} aria-current={on === t.key ? "page" : undefined}>
          <svg className="tab-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
            {ICONS[t.key]}
          </svg>
          <span>{app.nav[t.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
