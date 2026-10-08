import { useState } from "react";
import { useLoad, Loading, ErrorNote, FACET_LABEL, pct, lcUrl, CodeBlock } from "../ui.jsx";

const TYPE_LABEL = { fix: "Fix a gap", revise: "Revise", finish: "Finish", advance: "Move forward" };

export default function NextMove() {
  const { data, error, loading, reload } = useLoad("/me/next");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const [top, ...rest] = data.moves;

  if (!top) {
    return (
      <section className="page">
        <h1 className="page-title">Next move</h1>
        <div className="empty">
          <p>Nothing to recommend yet. Solve or attempt a problem on LeetCode with the extension on, and your first gaps and wins will show up here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <p className="kicker">Highest-value thing to do now</p>
      <Hero move={top} />
      {rest.length > 0 && (
        <section className="also">
          <h2>After that</h2>
          <ul className="rows">
            {rest.map((m, i) => <MoveRow key={i} move={m} />)}
          </ul>
        </section>
      )}
    </section>
  );
}

function Hero({ move }) {
  return (
    <article className={`hero hero-${move.type}`}>
      <span className={`type type-${move.type}`}>{TYPE_LABEL[move.type]}</span>
      <h1 className="hero-title">{move.title}</h1>
      <p className="hero-reason">{move.reason}</p>
      {move.type === "fix" && <FixDetail d={move.detail} />}
      {move.type !== "fix" && <div className="hero-actions"><MoveAction move={move} primary /></div>}
    </article>
  );
}

function FixDetail({ d }) {
  return (
    <div className="fix">
      <div className="fix-main">
        <p className="criterion"><strong>{FACET_LABEL[d.facet]}</strong> means: {d.criterion}</p>
        <Drill drill={d.drill} />
      </div>
      <aside className="fix-side">
        <h3>Plan</h3>
        <ol className="steps">
          {d.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        {d.practice.length > 0 && (
          <>
            <h3>Practice with</h3>
            <ul className="practice">
              {d.practice.map((p) => (
                <li key={p.id}>
                  {p.slug ? <a href={lcUrl(p.slug)} target="_blank" rel="noreferrer">{p.title}</a> : <span>{p.title}</span>}
                  <span className="quiet"> {p.role === "core" ? "tests it directly" : "uses it"}{p.solved ? ", solved before" : ""}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <h3>Current read</h3>
        <p className="quiet">{pct(d.mastery)} mastery from {d.evidence} units of evidence.</p>
        {d.surfacedVia.length > 0 && <p className="quiet">Found underneath: {d.surfacedVia.map((v) => v.split("·")[0]).join(", ")}.</p>}
      </aside>
    </div>
  );
}

function Drill({ drill }) {
  const [shown, setShown] = useState(false);
  const [hint, setHint] = useState(false);
  if (!drill) return null;
  return (
    <section className="drill" aria-label="Drill">
      <h3>Drill</h3>
      <p className="drill-q">{drill.question}</p>
      <CodeBlock code={drill.code} />
      <div className="drill-actions">
        {!shown && <button className="btn btn-primary" onClick={() => setShown(true)}>Show answer</button>}
        {!shown && drill.hint && !hint && <button className="btn" onClick={() => setHint(true)}>Show hint</button>}
      </div>
      {hint && !shown && <p className="hint">{drill.hint}</p>}
      {shown && <div className="answer"><p>{drill.answer}</p></div>}
      {drill.generatedBy === "template" && <p className="quiet small">Add a Gemini key in Settings to get generated drills instead of this outline.</p>}
    </section>
  );
}

function MoveRow({ move }) {
  return (
    <li className="row">
      <span className={`type type-${move.type}`}>{TYPE_LABEL[move.type]}</span>
      <div className="row-body">
        <p className="row-title">{move.title}</p>
        <p className="quiet">{move.reason}</p>
      </div>
      <MoveAction move={move} />
    </li>
  );
}

function MoveAction({ move, primary }) {
  const cls = `btn ${primary ? "btn-primary" : ""}`;
  if (move.type === "revise") return <a className={cls} href="#/revision">Start revision</a>;
  if (move.type === "fix") return <a className={cls} href={`#/mirror/${move.detail.node}`}>See concept</a>;
  const slug = move.detail.slug;
  if (slug) return <a className={cls} href={lcUrl(slug)} target="_blank" rel="noreferrer">Open on LeetCode</a>;
  return null;
}
