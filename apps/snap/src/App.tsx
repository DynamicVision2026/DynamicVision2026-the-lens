import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { app } from "./copy";
import type { Grade } from "./curriculum";
import { Archive } from "./screens/Archive";
import { Landing } from "./screens/Landing";
import { MapScreen } from "./screens/MapScreen";
import { Onboarding } from "./screens/Onboarding";
import { Privacy } from "./screens/Privacy";
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
  const [grade, setGrade] = useGrade();
  const nav = useNavigate();
  const choose = (g: Grade) => {
    setGrade(g);
    nav("/app/snap");
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
          <Route path="snap" element={<Snap grade={grade} />} />
          <Route path="map" element={<MapScreen grade={grade} />} />
          <Route path="list" element={<TestList grade={grade} />} />
          <Route path="archive" element={<Archive />} />
          <Route path="*" element={<Navigate to="/app/snap" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <Tab to="/app/snap" icon="◎" label={app.nav.snap} />
        <Tab to="/app/map" icon="▦" label={app.nav.map} />
        <Tab to="/app/list" icon="✓" label={app.nav.list} />
        <Tab to="/app/archive" icon="≡" label={app.nav.archive} />
      </nav>
    </div>
  );
}

function Tab({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}>
      <span className="tab-icon" aria-hidden>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
