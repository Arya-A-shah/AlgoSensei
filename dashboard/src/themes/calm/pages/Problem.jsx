import { useMemo } from "react";
import { useOverview, useLoad, Loading, ErrorNote, Verdict, lcUrl, timeAgo } from "../ui.jsx";
import { Dots } from "../art.jsx";
import { PROBLEM_STATE, shortName } from "../words.js";
import { ConceptChip } from "./Skills.jsx";

export default function Problem({ path }) {
  const { data, error, reload } = useOverview();
  const id = decodeURIComponent(path.split("/")[2] ?? "");
  const nodes = useMemo(() => (data ? new Map(data.layers.flatMap((l) => l.nodes.map((n) => [n.id, { ...n, layer: l.layer }]))) : new Map()), [data]);
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const i = data.sheet.findIndex((p) => p.id === id);
  const p = data.sheet[i];
  if (!p) return <div className="note"><p>That problem isn't on the sheet.</p><a className="btn" href="#/">Back home</a></div>;

  // Previous / next stay inside the topic.
  const prev = data.sheet[i - 1]?.topic === p.topic ? data.sheet[i - 1] : null;
  const next = data.sheet[i + 1]?.topic === p.topic ? data.sheet[i + 1] : null;
  const topicTitle = data.topics.find((t) => t.topic === p.topic)?.title ?? p.topic;
  const tagged = p.nodes.map((t) => ({ ...t, node: nodes.get(t.id) })).filter((t) => t.node);
  const core = tagged.filter((t) => t.role === "core");
  const uses = tagged.filter((t) => t.role !== "core");

  return (
    <section className="page">
      <header className="problem-head">
        <span className={`problem-num n-${p.status}`} aria-hidden="true">{p.order}</span>
        <div>
          <p className="eyebrow">{topicTitle} / {p.sectionTitle ?? p.section} / {p.tier}</p>
          <h1 className="h1"><span className="sr-only">Problem {p.order}: </span>{p.title}</h1>
          <p className="detail-status">
            <span className={`chip-status s-${p.status}`}>{PROBLEM_STATE[p.status]}</span>
            {p.firstTry && <span>Solved on the first submit</span>}
          </p>
          <div className="actions">
            {p.slug
              ? <a className="btn btn-primary" href={lcUrl(p.slug)} target="_blank" rel="noreferrer">Open on LeetCode</a>
              : <span className="muted">Not on LeetCode, so the extension can't track it yet.</span>}
          </div>
        </div>
      </header>

      {core.length > 0 && (
        <>
          <h2 className="h2">Concepts it tests</h2>
          <ul className="concepts concepts-tight">
            {core.map((t) => (
              <li key={t.id}>
                <a href={`#/skills/${t.id}`} className={`concept c-${t.node.summary.status}`}>
                  <span className="concept-name">{shortName(t.node.name)}</span>
                  <Dots facets={t.node.facets} />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {uses.length > 0 && (
        <>
          <h2 className="h2">Also uses</h2>
          <p className="chips">{uses.map((t) => <ConceptChip key={t.id} n={t.node} />)}</p>
        </>
      )}

      {p.slug && <Attempts slug={p.slug} />}

      <nav className="pager" aria-label="Neighbouring problems">
        {prev ? <a href={`#/p/${prev.id}`}>‹ {prev.order}. {prev.title}</a> : <span />}
        {next ? <a href={`#/p/${next.id}`}>{next.order}. {next.title} ›</a> : <span />}
      </nav>
    </section>
  );
}

function Attempts({ slug }) {
  const { data, error, loading, reload } = useLoad(`/me/attempts?slug=${encodeURIComponent(slug)}&limit=20`);
  return (
    <>
      <h2 className="h2">Your attempts</h2>
      {loading && !data && <Loading />}
      {error && <ErrorNote error={error} onRetry={reload} />}
      {data && !data.attempts.length && <p className="muted">None yet. Run your code on LeetCode and it shows up here.</p>}
      {data && data.attempts.length > 0 && <AttemptRows attempts={data.attempts} showTitle={false} />}
    </>
  );
}

export function AttemptRows({ attempts, showTitle = true }) {
  return (
    <ul className={`attempts ${showTitle ? "" : "no-title"}`}>
      {attempts.map((a) => (
        <li key={a.id}>
          <a href={`#/history/${a.id}`} className={`attempt ${a.verdict === "Accepted" ? "a-ok" : "a-bad"}`}>
            <Verdict verdict={a.verdict} />
            {showTitle && <span className="attempt-title">{a.title}</span>}
            <span className="muted">
              {a.kind === "submit" ? "Submit" : "Run"}
              {a.hintsBefore > 0 && <span className={`hint-badge h-${a.hintLevel ?? 0}`} title={`${a.hintsBefore} hint${a.hintsBefore > 1 ? "s" : ""} before this`}>hint {a.hintLevel ?? ""}</span>}
            </span>
            <span className="muted">{a.tests ?? ""}</span>
            <span className="attempt-delta">
              {a.masteryChanges.slice(0, 2).map((m, i) => (
                <span key={i} className={m.to >= m.from ? "up" : "down"}>{m.to >= m.from ? "↑" : "↓"} {shortName(m.nodeName)}</span>
              ))}
            </span>
            <span className="muted attempt-time">{timeAgo(a.createdAt)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
