import { InstallAsk } from "./components/InstallAsk";
import { ClaimLink } from "./screens/ClaimLink";
import type { ReactElement } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { app } from "./copy";
import type { Grade } from "./curriculum";
import { CameraGlyph } from "./components/SnapFab";
import { APP_TABS, type TabKey, activeTab, homePath, showsBackToMap } from "./lib/home";
import { EXAM_ENTRY } from "./lib/layers";
import { useLayout } from "./lib/layout";
import { Archive } from "./screens/Archive";
import { Landing } from "./screens/Landing";
import { MapScreen } from "./screens/MapScreen";
import { Onboarding } from "./screens/Onboarding";
import { PlanScreen } from "./screens/PlanScreen";
import { Privacy } from "./screens/Privacy";
import { Terms } from "./screens/Terms";
import { Report } from "./screens/Report";
import { Snap } from "./screens/Snap";
import { TestList } from "./screens/TestList";
import { useGrade } from "./state";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/app/claim" element={<ClaimLink />} />
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
  // wide (landscape iPad / phone sideways): no top bar; brand, grade and tabs live in a slim left rail
  const rail = useLayout().layout === "wide";
  const back = showsBackToMap(useLocation().pathname);
  if (!grade) return <Onboarding onChoose={choose} />;
  const chip = (
    <NavLink to="/app/grade" className={`grade-chip${gradeCheck ? " is-check" : ""}`} aria-label={app.grade.change} data-testid="grade-chip">
      {grade}
    </NavLink>
  );
  return (
    <div className={`shell${rail ? " has-rail" : ""}`}>
      {!rail && (
        <header className="topbar">
          <a href="/" className="brand">つまずきマップ</a>
          {chip}
        </header>
      )}
      {gradeCheck && (
        <div className="grade-check" role="status" data-testid="grade-check">
          <span>{app.grade.migrated(grade)}</span>
          <button type="button" className="link-btn" onClick={dismissGradeCheck}>
            {app.grade.ok}
          </button>
        </div>
      )}
      <main className="main">
        {back && (
          <div className="back-to-map">
            <Link to="/app/map" data-testid="back-to-map">
              <span aria-hidden>‹</span>
              {app.nav.backToMap}
            </Link>
          </div>
        )}
        <Routes>
          <Route path="grade" element={<Onboarding current={grade} onChoose={choose} />} />
          <Route index element={<Home />} />
          <Route path="snap" element={<Snap grade={grade} />} />
          <Route path="report" element={<Report grade={grade} />} />
          <Route path="map" element={<MapScreen grade={grade} />} />
          <Route path="exam" element={<MapScreen grade={grade} examEntry />} />
          <Route path="list" element={<TestList grade={grade} />} />
          <Route path="archive" element={<Archive />} />
          <Route path="plan" element={<PlanScreen />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
      <TabBar rail={rail ? chip : null} />
      <InstallAsk />
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

/**
 * Four tabs, マップ first; the 学習レポート (the map's 「詳しく」 page) keeps マップ lit. Bottom bar on phone and
 * tablet portrait; in wide layouts a slim left rail (icons + labels) headed by the brand and the grade chip,
 * so the map gets the full height.
 */
function TabBar({ rail }: { rail: ReactElement | null }) {
  const on = activeTab(useLocation().pathname);
  return (
    <nav className={`tabbar${rail ? " tabbar-rail" : ""}`} data-testid={rail ? "nav-rail" : undefined}>
      {rail && (
        <div className="rail-head">
          <a href="/" className="brand rail-brand" aria-label="つまずきマップ">
            <span aria-hidden>つまずき</span>
            <span aria-hidden>マップ</span>
          </a>
          {rail}
        </div>
      )}
      {APP_TABS.map((t) => (
        <Link key={t.key} to={t.to} state={t.key === "list" ? EXAM_ENTRY : undefined} className={`tab ${on === t.key ? "tab-active" : ""}`} aria-current={on === t.key ? "page" : undefined}>
          <svg className="tab-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
            {ICONS[t.key]}
          </svg>
          <span>{app.nav[t.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
