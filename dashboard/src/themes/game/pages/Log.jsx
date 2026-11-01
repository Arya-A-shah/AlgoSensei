import { useState } from "react";
import { api } from "../../../api.js";
import { useLoad, Loading, ErrorNote, Verdict, CodeBlock, pct, lcUrl, timeAgo, refreshOverview } from "../ui.jsx";
import { FACET, shortName } from "../game.js";
import { AttemptRows } from "./Problem.jsx";

export default function Log({ path }) {
  const id = path.split("/")[2];
  return id ? <Round id={id} /> : <RoundList />;
}

const dayLabel = (d) => {
  const day = new Date(d).toDateString();
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - 864e5).toDateString()) return "Yesterday";
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

function RoundList() {
  const [kind, setKind] = useState("");
  const { data, error, loading, reload } = useLoad(`/me/attempts?limit=100${kind ? `&kind=${kind}` : ""}`, [kind]);
  const groups = [];
  for (const a of data?.attempts ?? []) {
    const label = dayLabel(a.createdAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(a);
  }
  const wins = (data?.attempts ?? []).filter((a) => a.verdict === "Accepted").length;

  return (
    <section className="page">
      <header className="page-head">
        <h1 className="h-page">Fight log</h1>
        {data && <p className="page-sub"><span><b className="num st-solid">{wins}</b> won</span><span><b className="num st-weak">{data.attempts.length - wins}</b> lost</span></p>}
      </header>
      <div className="rooms rooms-small" role="group" aria-label="Show">
        {[["", "All"], ["submit", "Submits"], ["run", "Runs"]].map(([k, l]) => (
          <button key={k} className="room" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && !data.attempts.length && <p className="empty-line">No fights yet. Run or submit on LeetCode with the extension on.</p>}
      {groups.map((g) => (
        <section key={g.label} className="day">
          <h2 className="h-section">{g.label}</h2>
          <AttemptRows attempts={g.items} />
        </section>
      ))}
    </section>
  );
}

const HINT_NAME = { 1: "Nudge", 2: "Concept", 3: "Pinpoint" };

function Round({ id }) {
  const { data, error, loading, reload } = useLoad(`/me/attempts/${id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const a = data.attempt;
  const r = a.result ?? {};
  const hints = data.hints ?? [];
  const findings = a.analysis.findings ?? [];
  const hits = findings.filter((f) => f.polarity === "negative");
  const strengths = findings.filter((f) => f.polarity === "positive");
  const win = a.verdict === "Accepted";

  const reanalyze = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/me/attempts/${id}/reanalyze`, { method: "POST" });
      reload();
      refreshOverview();
    } catch (e) {
      setMsg(e.message);
    }
    setBusy(false);
  };

  return (
    <section className="page round-page">
      <a className="back" href="#/log">Fight log</a>
      <header className={`fight-card ${win ? "fc-solved" : "fc-lost"}`}>
        <span className="fight-num fight-result" aria-hidden="true">{win ? "Won" : "Lost"}</span>
        <div className="fight-body">
          <p className="fight-meta">
            <span>{a.kind === "submit" ? "Submit" : "Run"}</span>
            <span>{timeAgo(a.createdAt)}</span>
            {r.totalTestcases ? <span>{r.totalCorrect}/{r.totalTestcases} tests</span> : null}
            {r.runtime && r.runtime !== "N/A" ? <span>{r.runtime}</span> : null}
          </p>
          <h1 className="h-page">{a.title}</h1>
          <p className="fight-status"><Verdict verdict={a.verdict} /></p>
          <div className="fight-actions">
            {data.problem?.id && !data.problem.autoTagged && <a className="btn btn-ink" href={`#/p/${data.problem.id}`}>Problem</a>}
            {lcUrl(a.slug) && <a className="btn btn-ghost" href={lcUrl(a.slug)} target="_blank" rel="noreferrer">LeetCode</a>}
          </div>
        </div>
      </header>

      {a.analysis.status === "done" ? (
        <blockquote className="verdict-quote">
          <p>{a.analysis.summary}</p>
          <footer>
            {a.analysis.approachName ?? "Approach unclear"}
            {a.analysis.timeComplexity ? `, ${a.analysis.timeComplexity}` : ""}
          </footer>
        </blockquote>
      ) : (
        <div className="scroll-note">
          <p>{a.analysis.status === "pending" ? "The sensei is still reading this round." : a.analysis.status === "failed" ? `Reading failed: ${a.analysis.error}` : `Not graded: ${a.analysis.reason}.`}</p>
          {a.analysis.status !== "pending" && <button className="btn btn-strike" onClick={reanalyze} disabled={busy}>{busy ? "Reading…" : "Grade it now"}</button>}
          {msg && <p className="st-weak">{msg}</p>}
        </div>
      )}

      {a.analysis.rootCauseDesc && (
        <p className="root-cause"><span>Root cause</span>{a.analysis.rootCauseDesc}</p>
      )}

      {(hits.length > 0 || strengths.length > 0) && (
        <div className="hitboard">
          {hits.length > 0 && (
            <div>
              <h2 className="h-section">Hits taken</h2>
              <ul className="hits">
                {hits.map((f, i) => (
                  <li key={i}>
                    <a href={`#/dojo/${f.node}`}>{shortName(f.nodeName)}</a> <small>{FACET[f.facet]?.name}</small>
                    <span>{f.misconceptionDesc ?? f.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strengths.length > 0 && (
            <div>
              <h2 className="h-section">Clean strikes</h2>
              <ul className="strikes">
                {strengths.map((f, i) => (
                  <li key={i}>
                    <a href={`#/dojo/${f.node}`}>{shortName(f.nodeName)}</a> <small>{FACET[f.facet]?.name}</small>
                    <span>{f.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {a.masteryChanges?.length > 0 && (
        <>
          <h2 className="h-section">Skill changes</h2>
          <ul className="changes">
            {a.masteryChanges.map((m, i) => {
              const up = m.to >= m.from;
              return (
                <li key={i} className={up ? "ch-up" : "ch-down"}>
                  <a href={`#/dojo/${m.node}`}>{shortName(m.nodeName)}</a>
                  <small>{FACET[m.facet]?.name}</small>
                  <span className="ch-bar" aria-hidden="true">
                    <span className="ch-from" style={{ width: pct(Math.min(m.from, m.to)) }} />
                    <span className="ch-delta" style={{ left: pct(Math.min(m.from, m.to)), width: pct(Math.abs(m.to - m.from)) }} />
                  </span>
                  <b className="num">{pct(m.from)} → {pct(m.to)}</b>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {hints.length > 0 && (
        <>
          <h2 className="h-section">Hints before this round</h2>
          <ol className="hint-list">
            {hints.map((h, i) => (
              <li key={i} className={`hint-item hl-${h.level ?? 0}`}>
                <p className="hint-head">
                  <span className={`hint-badge hl-${h.level ?? 0}`}>H{h.level ?? ""}</span>
                  <b>{h.level ? HINT_NAME[h.level] : "Hint"}</b>
                  {h.focusName && <a href={`#/dojo/${h.focusNode}`}>{shortName(h.focusName)}</a>}
                  <small>{timeAgo(h.at)}</small>
                </p>
                {h.text && <p className="hint-text">{h.text}</p>}
              </li>
            ))}
          </ol>
        </>
      )}

      {(r.lastTestcase || r.compileError || r.runtimeError) && !win && (
        <>
          <h2 className="h-section">Where it broke</h2>
          {r.lastTestcase && <CodeBlock code={r.lastTestcase} />}
          {r.expectedOutput && <p className="broke">Expected <code>{r.expectedOutput}</code> got <code>{r.codeOutput || "(empty)"}</code></p>}
          {r.compileError && <CodeBlock code={r.compileError} />}
          {r.runtimeError && <CodeBlock code={r.runtimeError} />}
        </>
      )}

      {a.code && (
        <details className="code-details">
          <summary>Your code</summary>
          <CodeBlock code={a.code} />
        </details>
      )}
    </section>
  );
}
