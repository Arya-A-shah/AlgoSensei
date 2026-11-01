import { useState } from "react";
import { api } from "../../../api.js";
import { useLoad, Loading, ErrorNote, Verdict, CodeBlock, pct, lcUrl, timeAgo, refreshOverview } from "../ui.jsx";
import { Scroll } from "../art.jsx";
import { FACET, shortName } from "../words.js";
import { AttemptRows } from "./Problem.jsx";

export default function History({ path }) {
  const id = path.split("/")[2];
  return id ? <Attempt id={id} /> : <AttemptList />;
}

const dayLabel = (d) => {
  const day = new Date(d).toDateString();
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - 864e5).toDateString()) return "Yesterday";
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

function AttemptList() {
  const [kind, setKind] = useState("");
  const { data, error, loading, reload } = useLoad(`/me/attempts?limit=100${kind ? `&kind=${kind}` : ""}`, [kind]);
  const groups = [];
  for (const a of data?.attempts ?? []) {
    const label = dayLabel(a.createdAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(a);
  }
  return (
    <section className="page">
      <header className="page-head">
        <h1 className="h1">History</h1>
        <div className="tabs tabs-small" role="group" aria-label="Show">
          {[["", "All"], ["submit", "Submits"], ["run", "Runs"]].map(([k, l]) => (
            <button key={k} className="tab" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
      </header>
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && !data.attempts.length && <p className="muted">No attempts yet. Run or submit on LeetCode with the extension on.</p>}
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="h2">{g.label}</h2>
          <AttemptRows attempts={g.items} />
        </section>
      ))}
    </section>
  );
}

const HINT_NAME = { 1: "Nudge", 2: "Concept", 3: "Pinpoint" };

function Attempt({ id }) {
  const { data, error, loading, reload } = useLoad(`/me/attempts/${id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const a = data.attempt;
  const r = a.result ?? {};
  const hints = data.hints ?? [];
  const findings = a.analysis.findings ?? [];
  const gaps = findings.filter((f) => f.polarity === "negative");
  const strengths = findings.filter((f) => f.polarity === "positive");
  const ok = a.verdict === "Accepted";

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
    <section className="page">
      <a className="back" href="#/history">History</a>
      <header className="detail-head">
        <p className="eyebrow">
          {a.kind === "submit" ? "Submit" : "Run"}, {timeAgo(a.createdAt)}
          {r.totalTestcases ? `, ${r.totalCorrect}/${r.totalTestcases} tests` : ""}
        </p>
        <h1 className="h1">{a.title}</h1>
        <p className="detail-status"><Verdict verdict={a.verdict} /></p>
        <div className="actions">
          {data.problem?.id && !data.problem.autoTagged && <a className="btn" href={`#/p/${data.problem.id}`}>Problem</a>}
          {lcUrl(a.slug) && <a className="btn" href={lcUrl(a.slug)} target="_blank" rel="noreferrer">Open on LeetCode</a>}
        </div>
      </header>

      {a.analysis.status === "done" ? (
        <div className="summary">
          <p>{a.analysis.summary}</p>
          <p className="muted">{a.analysis.approachName ?? "Approach unclear"}{a.analysis.timeComplexity ? `, ${a.analysis.timeComplexity}` : ""}</p>
        </div>
      ) : (
        <div className="note">
          <p>{a.analysis.status === "pending" ? "Still being graded." : a.analysis.status === "failed" ? `Grading failed: ${a.analysis.error}` : `Not graded: ${a.analysis.reason}.`}</p>
          {a.analysis.status !== "pending" && <button className="btn btn-primary" onClick={reanalyze} disabled={busy}>{busy ? "Grading…" : "Grade now"}</button>}
          {msg && <p className="err">{msg}</p>}
        </div>
      )}

      {a.analysis.rootCauseDesc && <p className="root"><b>Root cause</b>{a.analysis.rootCauseDesc}</p>}

      {(gaps.length > 0 || strengths.length > 0) && (
        <div className="two-col">
          {gaps.length > 0 && (
            <div>
              <h2 className="h2">Gaps</h2>
              <ul className="findings">
                {gaps.map((f, i) => (
                  <li key={i} className="f-gap">
                    <a href={`#/skills/${f.node}`}>{shortName(f.nodeName)}</a> <span className="muted">{FACET[f.facet]?.name}</span>
                    <span className="finding-text">{f.misconceptionDesc ?? f.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strengths.length > 0 && (
            <div>
              <h2 className="h2">Done well</h2>
              <ul className="findings">
                {strengths.map((f, i) => (
                  <li key={i} className="f-good">
                    <a href={`#/skills/${f.node}`}>{shortName(f.nodeName)}</a> <span className="muted">{FACET[f.facet]?.name}</span>
                    <span className="finding-text">{f.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {a.masteryChanges?.length > 0 && (
        <>
          <h2 className="h2">Mastery changes</h2>
          <ul className="changes">
            {a.masteryChanges.map((m, i) => (
              <li key={i} className={m.to >= m.from ? "up" : "down"}>
                <a href={`#/skills/${m.node}`}>{shortName(m.nodeName)}</a>
                <span className="muted">{FACET[m.facet]?.name}</span>
                <span className="change-val">{pct(m.from)} → {pct(m.to)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hints.length > 0 && (
        <>
          <h2 className="h2">Hints before this attempt</h2>
          <div className="hint-scrolls">
            {hints.map((h, i) => (
              <Scroll key={i} className={`hint h-${h.level ?? 0}`} label={`Hint ${i + 1}`}>
                <p className="scroll-title">
                  {h.level ? HINT_NAME[h.level] : "Hint"}
                  {h.focusName && <> on <a href={`#/skills/${h.focusNode}`}>{shortName(h.focusName)}</a></>}
                  <span className="muted"> {timeAgo(h.at)}</span>
                </p>
                {h.text && <p className="hint-text">{h.text}</p>}
              </Scroll>
            ))}
          </div>
        </>
      )}

      {(r.lastTestcase || r.compileError || r.runtimeError) && !ok && (
        <>
          <h2 className="h2">Failing case</h2>
          {r.lastTestcase && <CodeBlock code={r.lastTestcase} />}
          {r.expectedOutput && <p>Expected <code>{r.expectedOutput}</code>, got <code>{r.codeOutput || "(empty)"}</code></p>}
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
