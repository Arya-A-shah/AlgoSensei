import { useEffect, useState } from "react";
import { settings } from "./api.js";
import NextMove from "./pages/NextMove.jsx";
import Mirror from "./pages/Mirror.jsx";
import History from "./pages/History.jsx";
import Revision from "./pages/Revision.jsx";
import Settings from "./pages/Settings.jsx";

const ROUTES = [
  { path: "/", label: "Next move", el: NextMove },
  { path: "/mirror", label: "Mirror", el: Mirror },
  { path: "/revision", label: "Revision", el: Revision },
  { path: "/history", label: "History", el: History },
  { path: "/settings", label: "Settings", el: Settings },
];

const currentPath = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

export default function App() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const base = "/" + (path.split("/")[1] ?? "");
  const route = ROUTES.find((r) => r.path === base) ?? ROUTES[0];
  const Page = route.el;
  const hasToken = Boolean(settings.token);

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <a className="brand" href="#/">
          <MirrorMark />
          <span>AlgoSensei</span>
        </a>
        <ul>
          {ROUTES.map((r) => (
            <li key={r.path}>
              <a href={`#${r.path}`} aria-current={r === route ? "page" : undefined}>{r.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="main">
        {hasToken || route.path === "/settings" ? <Page path={path} /> : <Welcome />}
      </main>
    </div>
  );
}

function Welcome() {
  return (
    <section className="welcome">
      <h1>Your mirror is empty</h1>
      <p>This dashboard shows what your LeetCode runs and submits say about your understanding. It needs the identity your extension created.</p>
      <ol>
        <li>Load the AlgoSensei extension in Chrome.</li>
        <li>Open any LeetCode problem and click the extension icon.</li>
        <li>Choose <strong>Open dashboard</strong>. You only need to do this once per browser.</li>
      </ol>
      <p className="quiet">Want to look around first? Run <code>npm run seed</code> in the api folder and open the link it prints.</p>
    </section>
  );
}

// Two facing strips: the knowledge and its reflection.
function MirrorMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="2" y="3" width="7" height="3" rx="1" className="mk-a" />
      <rect x="2" y="9.5" width="7" height="3" rx="1" className="mk-b" />
      <rect x="2" y="16" width="7" height="3" rx="1" className="mk-c" />
      <line x1="11" y1="1" x2="11" y2="21" className="mk-line" />
      <rect x="13" y="3" width="7" height="3" rx="1" className="mk-a" opacity=".45" />
      <rect x="13" y="9.5" width="7" height="3" rx="1" className="mk-b" opacity=".45" />
      <rect x="13" y="16" width="7" height="3" rx="1" className="mk-c" opacity=".45" />
    </svg>
  );
}
