import { useEffect, useRef, useState } from "react";
import { settings } from "./api.js";
import { useOverview } from "./ui.jsx";
import { BeltIcon, NavIcon, Backdrop, Sensei } from "./art.jsx";
import { beltRank } from "./game.js";
import Home from "./pages/Home.jsx";
import Dojo from "./pages/Dojo.jsx";
import Arena from "./pages/Arena.jsx";
import Log from "./pages/Log.jsx";
import Problem from "./pages/Problem.jsx";
import Settings from "./pages/Settings.jsx";

const ROUTES = [
  { path: "/", label: "Sensei", icon: "sensei", el: Home },
  { path: "/dojo", label: "Dojo", icon: "dojo", el: Dojo },
  { path: "/arena", label: "Arena", icon: "arena", el: Arena },
  { path: "/log", label: "Fight log", icon: "log", el: Log },
  { path: "/settings", label: "Settings", icon: "settings", el: Settings, quiet: true },
];
const HIDDEN = [{ path: "/p", el: Problem }];
// Links from older versions keep working.
const LEGACY = { "/mirror": "/dojo", "/revision": "/arena", "/history": "/log" };

const currentPath = () => {
  const p = location.hash.replace(/^#/, "").split("?")[0] || "/";
  const base = "/" + (p.split("/")[1] ?? "");
  return LEGACY[base] ? p.replace(base, LEGACY[base]) : p;
};

export default function App() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => {
      setPath(currentPath());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const base = "/" + (path.split("/")[1] ?? "");
  const route = [...ROUTES, ...HIDDEN].find((r) => r.path === base) ?? ROUTES[0];
  const Page = route.el;
  const hasToken = Boolean(settings.token);

  return (
    <div className="game">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="top">
        <div className="top-row">
          <a className="brand" href="#/" aria-label="AlgoSensei home">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M1 14 L12 3 L23 14 Q12 17 1 14 Z" fill="currentColor" /></svg>
            <span>AlgoSensei</span>
          </a>
          {hasToken && <Hud />}
          <nav className="nav" aria-label="Main">
            {ROUTES.map((r) => (
              <a key={r.path} href={`#${r.path}`} className={r.quiet ? "nav-quiet" : ""} aria-current={r === route ? "page" : undefined} aria-label={r.label}>
                <NavIcon name={r.icon} />
                <span className="nav-label">{r.label}</span>
              </a>
            ))}
          </nav>
        </div>
        {hasToken && <ProblemStrip activeId={base === "/p" ? decodeURIComponent(path.split("/")[2] ?? "") : null} />}
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {hasToken || route.path === "/settings" ? <Page path={path} /> : <Welcome />}
      </main>
    </div>
  );
}

function Hud() {
  const { data } = useOverview();
  if (!data) return <div className="hud" />;
  const s = data.stats;
  const belt = beltRank(s.solved, data.sheet.length);
  return (
    <div className="hud" aria-label="Your progress">
      <span className="hud-item hud-belt" title={belt.next ? `${belt.toNext} more solve${belt.toNext > 1 ? "s" : ""} to ${belt.next.name} belt` : "Top belt"}>
        <BeltIcon color={belt.color} />
        <span><b>{belt.name} belt</b>{belt.next && <small>{belt.toNext} to {belt.next.name}</small>}</span>
      </span>
      <span className="hud-item"><b className="num">{s.solved}<i>/{data.sheet.length}</i></b><small>won</small></span>
      <span className="hud-item"><b className="num">{s.streakDays}</b><small>day streak</small></span>
      {s.cardsDue > 0 && <a className="hud-item hud-due" href="#/arena"><b className="num">{s.cardsDue}</b><small>to spar</small></a>}
    </div>
  );
}

const SECTION = { fundamentals: "Basics", logic_building: "Logic", faq_medium: "Medium", faq_hard: "Hard" };

function ProblemStrip({ activeId }) {
  const { data } = useOverview();
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeId, data]);
  if (!data) return <div className="strip strip-empty" />;

  let lastSection = null;
  return (
    <nav className="strip" aria-label="Problems" ref={ref}>
      <ol>
        {data.sheet.map((p) => {
          const head = p.section !== lastSection ? SECTION[p.section] ?? p.section : null;
          lastSection = p.section;
          const label = `${p.order}. ${p.title}: ${p.status === "solved" ? "won" : p.status === "attempted" ? "in progress" : "not fought yet"}${p.slug ? "" : ", not on LeetCode"}`;
          return (
            <li key={p.id} className={head ? "strip-new-section" : ""}>
              {head && <span className="strip-section">{head}</span>}
              <a href={`#/p/${p.id}`} className={`ptile pt-${p.status} ${p.slug ? "" : "pt-offline"}`} aria-current={p.id === activeId ? "page" : undefined} aria-label={label} title={label}>
                <span className="ptile-num">{p.order}</span>
                <span className="ptile-name">{p.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Welcome() {
  return (
    <section className="scene scene-welcome">
      <Backdrop />
      <div className="scene-cast">
        <Sensei />
        <div className="speech">
          <p className="speech-say">Bow in first.</p>
          <ol className="welcome-steps">
            <li>Load the AlgoSensei extension in Chrome.</li>
            <li>Open any LeetCode problem and click its icon.</li>
            <li>Press <b>Open dashboard</b>. Once per browser.</li>
          </ol>
          <p className="speech-why">Just looking? Run <code>npm run seed</code> in the api folder and open the link it prints.</p>
        </div>
      </div>
    </section>
  );
}
