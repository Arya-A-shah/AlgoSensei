import { useMemo } from "react";
import { useOverview, useLoad, Loading, ErrorNote, Verdict, lcUrl, timeAgo } from "../ui.jsx";
import { Emblem, Weapon, Pips, Glyph } from "../art.jsx";
import { SCHOOLS, WEAPONS, STATUS, shortName } from "../game.js";

const STATE = { solved: "Won", attempted: "In progress", new: "Not fought" };
const SECTION = { fundamentals: "Basics", logic_building: "Logic", faq_medium: "Medium", faq_hard: "Hard" };

export default function Problem({ path }) {
  const { data, error, reload } = useOverview();
  const id = decodeURIComponent(path.split("/")[2] ?? "");
  const nodes = useMemo(() => (data ? new Map(data.layers.flatMap((l) => l.nodes.map((n) => [n.id, { ...n, layer: l.layer }]))) : new Map()), [data]);

  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const i = data.sheet.findIndex((p) => p.id === id);
  const p = data.sheet[i];
  if (!p) return <div className="scroll-note"><p>That problem isn't on the sheet.</p><a className="btn" href="#/">Back to the sensei</a></div>;

  const prev = data.sheet[i - 1];
  const next = data.sheet[i + 1];
  const tagged = p.nodes.map((t) => ({ ...t, node: nodes.get(t.id) })).filter((t) => t.node);
  const weapons = tagged.filter((t) => t.node.layer === 2);
  const core = tagged.filter((t) => t.role === "core" && t.node.layer !== 2);
  const support = tagged.filter((t) => t.role !== "core" && t.node.layer !== 2);

  return (
    <section className="page problem-page">
      <header className={`fight-card fc-${p.status}`}>
        <span className="fight-num" aria-hidden="true">{p.order}</span>
        <div className="fight-body">
          <p className="fight-meta">
            <span>{SECTION[p.section] ?? p.section}</span>
            <span>{p.tier}</span>
          </p>
          <h1 className="h-page"><span className="sr-only">Problem {p.order}: </span>{p.title}</h1>
          <p className="fight-status">
            <span className={`status-chip sc-${p.status}`}>{STATE[p.status]}</span>
            {p.firstTry && <span className="badge-gold">First try</span>}
          </p>
          <div className="fight-actions">
            {p.slug ? (
              <a className="btn btn-strike" href={lcUrl(p.slug)} target="_blank" rel="noreferrer">{p.status === "solved" ? "Fight again on LeetCode" : "Fight on LeetCode"}</a>
            ) : (
              <span className="offline-note">Not on LeetCode, so it can't be tracked yet.</span>
            )}
          </div>
        </div>
      </header>

      {weapons.length > 0 && (
        <>
          <h2 className="h-section">Weapons</h2>
          <ul className="weapon-row">
            {weapons.map((t) => (
              <li key={t.id}>
                <a href={`#/dojo/${t.id}`} className={`weapon-pill wc-${t.node.summary.status}`}>
                  <Weapon id={t.id} size={36} />
                  <span>{WEAPONS[t.id]?.weapon ?? shortName(t.node.name)}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {core.length > 0 && (
        <>
          <h2 className="h-section">Skills it tests</h2>
          <ul className="skills skills-tight">
            {core.map((t) => (
              <li key={t.id}>
                <a href={`#/dojo/${t.id}`} className={`skill sk-${t.node.summary.status}`}>
                  <Emblem node={t.node} size={56} />
                  <span className="skill-name">{shortName(t.node.name)}</span>
                  <Pips facets={t.node.facets} />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {support.length > 0 && (
        <>
          <h2 className="h-section">Also uses</h2>
          <p className="chips">
            {support.map((t) => (
              <a key={t.id} href={`#/dojo/${t.id}`} className={`chip chip-${t.node.summary.status}`} title={STATUS[t.node.summary.status].name}>
                <Glyph name={SCHOOLS[t.node.layer].glyph} size={14} />{shortName(t.node.name)}
              </a>
            ))}
          </p>
        </>
      )}

      {p.slug && <Fights slug={p.slug} />}

      <nav className="pager" aria-label="Neighbouring problems">
        {prev ? <a href={`#/p/${prev.id}`} className="pager-prev"><small>{prev.order}</small>{prev.title}</a> : <span />}
        {next ? <a href={`#/p/${next.id}`} className="pager-next"><small>{next.order}</small>{next.title}</a> : <span />}
      </nav>
    </section>
  );
}

function Fights({ slug }) {
  const { data, error, loading, reload } = useLoad(`/me/attempts?slug=${encodeURIComponent(slug)}&limit=20`);
  return (
    <>
      <h2 className="h-section">Your fights</h2>
      {loading && !data && <Loading />}
      {error && <ErrorNote error={error} onRetry={reload} />}
      {data && !data.attempts.length && <p className="empty-line">No rounds yet. Run your code on LeetCode and it shows up here.</p>}
      {data && data.attempts.length > 0 && <AttemptRows attempts={data.attempts} showTitle={false} />}
    </>
  );
}

export function AttemptRows({ attempts, showTitle = true }) {
  return (
    <ul className="rounds">
      {attempts.map((a) => (
        <li key={a.id}>
          <a href={`#/log/${a.id}`} className={`round ${a.verdict === "Accepted" ? "round-win" : "round-loss"}`}>
            <Verdict verdict={a.verdict} />
            {showTitle && <span className="round-title">{a.title}</span>}
            <span className="round-kind">{a.kind === "submit" ? "Submit" : "Run"}{a.hintsBefore > 0 && <span className={`hint-badge hl-${a.hintLevel ?? 0}`} title={`${a.hintsBefore} hint${a.hintsBefore > 1 ? "s" : ""} before this`}>H{a.hintLevel ?? ""}</span>}</span>
            <span className="round-tests">{a.tests ?? ""}</span>
            <span className="round-gain">
              {a.masteryChanges.slice(0, 2).map((m, i) => (
                <span key={i} className={m.to >= m.from ? "gain-up" : "gain-down"}>{m.to >= m.from ? "▲" : "▼"} {shortName(m.nodeName)}</span>
              ))}
            </span>
            <span className="round-time">{timeAgo(a.createdAt)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
