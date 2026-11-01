import { useEffect, useRef, useState } from "react";
import { settings } from "../../api.js";
import { useOverview } from "./ui.jsx";
import { Icon, Sensei, HangingScroll } from "./art.jsx";
import { SECTION, PROBLEM_STATE } from "./words.js";
import Home from "./pages/Home.jsx";
import Skills from "./pages/Skills.jsx";
import Practice from "./pages/Practice.jsx";
import History from "./pages/History.jsx";
import Problem from "./pages/Problem.jsx";
import Settings from "./pages/Settings.jsx";

const ROUTES = [
  { path: "/", label: "Sensei", icon: "sensei", el: Home },
  { path: "/skills", label: "Skills", icon: "skills", el: Skills },
  { path: "/practice", label: "Practice", icon: "practice", el: Practice },
  { path: "/history", label: "History", icon: "history", el: History },
  { path: "/settings", label: "Settings", icon: "settings", el: Settings, iconOnly: true },
];
const HIDDEN = [{ path: "/p", el: Problem }];
// Links from the other theme and older versions keep working.
const ALIAS = { "/dojo": "/skills", "/mirror": "/skills", "/arena": "/practice", "/revision": "/practice", "/log": "/history" };

const currentPath = () => {
  const p = location.hash.replace(/^#/, "").split("?")[0] || "/";
  const base = "/" + (p.split("/")[1] ?? "");
  return ALIAS[base] ? p.replace(base, ALIAS[base]) : p;
};

export default function App() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => { setPath(currentPath()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const base = "/" + (path.split("/")[1] ?? "");
  const route = [...ROUTES, ...HIDDEN].find((r) => r.path === base) ?? ROUTES[0];
  const Page = route.el;
  const hasToken = Boolean(settings.token);

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="top">
        <div className="top-row">
          <a className="brand" href="#/">AlgoSensei</a>
          {hasToken && <Stats />}
          <nav className="nav" aria-label="Main">
            {ROUTES.map((r) => (
              <a key={r.path} href={`#${r.path}`} aria-current={r === route ? "page" : undefined} aria-label={r.label} className={r.iconOnly ? "icon-only" : ""}>
                <Icon name={r.icon} />
                <span className="nav-label">{r.label}</span>
              </a>
            ))}
          </nav>
        </div>
        {hasToken && <ProblemStrip activeId={base === "/p" ? decodeURIComponent(path.split("/")[2] ?? "") : null} />}
      </header>
      <main id="main" className="main" tabIndex={-1}>
        <HangingScroll key={base}>{hasToken || route.path === "/settings" ? <Page path={path} /> : <Welcome />}</HangingScroll>
      </main>
    </div>
  );
}

function Stats() {
  const { data } = useOverview();
  if (!data) return <div className="stats" />;
  const s = data.stats;
  return (
    <dl className="stats">
      <div><dt>Solved</dt><dd>{s.solved}<small>/{data.sheet.length}</small></dd></div>
      <div><dt>Streak</dt><dd>{s.streakDays}<small>d</small></dd></div>
      {s.cardsDue > 0 && <div className="stat-due"><dt>Due</dt><dd><a href="#/practice">{s.cardsDue}</a></dd></div>}
    </dl>
  );
}

function ProblemStrip({ activeId }) {
  const { data } = useOverview();
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeId, data]);
  if (!data) return <div className="strip strip-empty" />;
  let last = null;
  return (
    <nav className="strip" aria-label="Problems" ref={ref}>
      <ol>
        {data.sheet.map((p) => {
          const head = p.section !== last ? SECTION[p.section] ?? p.section : null;
          last = p.section;
          const label = `${p.order}. ${p.title}: ${PROBLEM_STATE[p.status]}${p.slug ? "" : ", not on LeetCode"}`;
          return (
            <li key={p.id} className={head ? "new-section" : ""}>
              {head && <span className="strip-section">{head}</span>}
              <a href={`#/p/${p.id}`} className={`tile t-${p.status} ${p.slug ? "" : "t-offline"}`} aria-current={p.id === activeId ? "page" : undefined} aria-label={label} title={label}>
                <span className="tile-num">{p.order}</span>
                <span className="tile-name">{p.title}</span>
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
    <section className="sensei-card">
      <Sensei size={96} />
      <div className="sensei-words">
        <p className="say">Connect the extension first.</p>
        <ol className="steps">
          <li>Load the AlgoSensei extension in Chrome.</li>
          <li>Open any LeetCode problem and click the extension icon.</li>
          <li>Press <b>Open dashboard</b>. Once per browser.</li>
        </ol>
        <p className="why">Just looking? Run <code>npm run seed</code> in the api folder and open the link it prints.</p>
      </div>
    </section>
  );
}
