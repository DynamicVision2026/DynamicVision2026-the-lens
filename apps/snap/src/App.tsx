import type { ReactElement } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { app } from "./copy";
import type { Grade } from "./curriculum";
import { Archive } from "./screens/Archive";
import { Landing } from "./screens/Landing";
import { MapScreen } from "./screens/MapScreen";
import { Onboarding } from "./screens/Onboarding";
import { Privacy } from "./screens/Privacy";
import { Report } from "./screens/Report";
import { Snap } from "./screens/Snap";
import { TestList } from "./screens/TestList";
import { useGrade, usePages } from "./state";

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
  const [grade, setGrade] = useGrade();
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
        <NavLink to="/app/grade" className="grade-chip" aria-label={app.grade.change}>
          {grade}
        </NavLink>
      </header>
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
      <nav className="tabbar">
        <Tab to="/app/snap" icon="snap" label={app.nav.snap} />
        <Tab to="/app/report" icon="report" label={app.nav.report} />
        <Tab to="/app/map" icon="map" label={app.nav.map} />
        <Tab to="/app/list" icon="list" label={app.nav.list} />
        <Tab to="/app/archive" icon="archive" label={app.nav.archive} />
      </nav>
    </div>
  );
}

/** App home: the レポート once the family has saved pages, 撮る before that. */
function Home() {
  const { pages } = usePages();
  if (!pages) return <div className="page" />;
  return <Navigate to={pages.length > 0 ? "/app/report" : "/app/snap"} replace />;
}

type IconName = "snap" | "report" | "map" | "list" | "archive";

/** Tab icons: 24 px line drawings in currentColor (no colour of their own). */
const ICONS: Record<IconName, ReactElement> = {
  snap: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  report: (
    <>
      <rect x="3.5" y="5" width="17" height="5" rx="2.5" />
      <path d="M10 5v5M15 5v5M4 15h9M4 19h6" />
    </>
  ),
  map: <path d="M12 3.5l2.3 5.6 5.7.4-4.4 3.7 1.4 5.8L12 15.9 7 19l1.4-5.8L4 9.5l5.7-.4z" />,
  list: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.5l2.8 2.8L16 9.5" />
    </>
  ),
  archive: <path d="M5 6h14M5 12h14M5 18h9" />,
};

function Tab({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}>
      <svg className="tab-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
        {ICONS[icon]}
      </svg>
      <span>{label}</span>
    </NavLink>
  );
}
