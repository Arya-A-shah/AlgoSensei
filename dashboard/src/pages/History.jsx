import { useState } from "react";
import { api } from "../api.js";
import { useLoad, Loading, ErrorNote, Verdict, CodeBlock, FACET_LABEL, pct, lcUrl, timeAgo } from "../ui.jsx";

export default function History({ path }) {
  const id = path.split("/")[2];
  return id ? <AttemptDetail id={id} /> : <AttemptList />;
}

const dayLabel = (d) => {
  const day = new Date(d).toDateString();
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - 864e5).toDateString()) return "Yesterday";
  return new Date(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
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
    <section className="page page-wide">
      <header className="list-head">
        <h1 className="page-title">History</h1>
        <div className="seg" role="group" aria-label="Filter attempts">
          {[["", "All"], ["submit", "Submits"], ["run", "Runs"]].map(([k, l]) => (
            <button key={k} className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
      </header>
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && !data.attempts.length && <div className="empty"><p>No attempts yet. Run or submit code on LeetCode with the extension on and it appears here within seconds.</p></div>}
      {groups.map((g) => (
        <section key={g.label} className="day">
          <h2>{g.label}</h2>
          <ul className="attempts">
            {g.items.map((a) => (
              <li key={a.id}>
                <a href={`#/history/${a.id}`} className="attempt">
                  <span className="a-time quiet">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="a-title">{a.title}</span>
                  <span className="a-kind quiet">{a.kind === "submit" ? "Submit" : "Run"}</span>
                  <Verdict verdict={a.verdict} />
                  <span className="a-tests quiet">{a.tests ?? ""}</span>
                  <span className="a-note">
                    {a.analysis.status === "done"
                      ? a.analysis.rootCause?.desc ?? a.analysis.summary
                      : a.analysis.status === "pending" ? "Analysing…" : <span className="quiet">Not graded</span>}
                  </span>
                  <span className="a-delta">{a.masteryChanges.slice(0, 3).map((m, i) => <Delta key={i} m={m} />)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function Delta({ m }) {
  const up = m.to >= m.from;
  return <span className={`delta ${up ? "up" : "down"}`} title={`${m.nodeName} · ${FACET_LABEL[m.facet]}: ${pct(m.from)} to ${pct(m.to)}`}>{up ? "▲" : "▼"} {m.nodeName}</span>;
}

function AttemptDetail({ id }) {
  const { data, error, loading, reload } = useLoad(`/me/attempts/${id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const a = data.attempt;
  const r = a.result ?? {};
  const findings = [...(a.analysis.findings ?? [])].sort((x, y) => (x.polarity === y.polarity ? y.confidence - x.confidence : x.polarity === "negative" ? -1 : 1));

  const reanalyze = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/me/attempts/${id}/reanalyze`, { method: "POST" });
      reload();
    } catch (e) {
      setMsg(e.message);
    }
    setBusy(false);
  };

  return (
    <section className="page">
      <a href="#/history" className="back">All attempts</a>
      <h1 className="page-title">{a.title}</h1>
      <p className="meta-line">
        <Verdict verdict={a.verdict} /> <span className="quiet">{a.kind === "submit" ? "Submit" : "Run"}, {timeAgo(a.createdAt)}{r.totalTestcases ? `, ${r.totalCorrect}/${r.totalTestcases} tests` : ""}{r.runtime && r.runtime !== "N/A" ? `, ${r.runtime}` : ""}</span>
        {lcUrl(a.slug) && <> <a href={lcUrl(a.slug)} target="_blank" rel="noreferrer">Open on LeetCode</a></>}
      </p>

      {a.analysis.status === "done" ? (
        <section className="reading">
          <p className="reading-summary">{a.analysis.summary}</p>
          <p className="quiet">
            Approach: {a.analysis.approachName ?? "unidentified"} ({a.analysis.approachLevel})
            {a.analysis.timeComplexity ? `, time ${a.analysis.timeComplexity}` : ""}{a.analysis.spaceComplexity ? `, space ${a.analysis.spaceComplexity}` : ""}
          </p>
          {a.analysis.rootCauseDesc && <p className="root"><strong>Root cause:</strong> {a.analysis.rootCauseDesc}</p>}
        </section>
      ) : (
        <div className="note">
          <p>{a.analysis.status === "pending" ? "Still analysing this attempt." : a.analysis.status === "failed" ? `Analysis failed: ${a.analysis.error}` : `Not graded: ${a.analysis.reason}.`}</p>
          {a.analysis.status !== "pending" && <button className="btn" onClick={reanalyze} disabled={busy}>{busy ? "Analysing…" : "Analyse now"}</button>}
          {msg && <p className="st-text-weak">{msg}</p>}
        </div>
      )}

      {findings.length > 0 && (
        <section>
          <h2>What this attempt shows</h2>
          <ul className="findings">
            {findings.map((f, i) => (
              <li key={i} className={`finding f-${f.polarity}`}>
                <span className="f-mark" aria-label={f.polarity === "negative" ? "Gap" : "Strength"}>{f.polarity === "negative" ? "−" : "+"}</span>
                <div>
                  <p><a href={`#/mirror/${f.node}`}>{f.nodeName}</a> <span className="quiet">· {f.facetLabel}</span></p>
                  <p>{f.misconceptionDesc ?? f.evidence}</p>
                  {f.misconceptionDesc && f.evidence && <p className="quiet small">Seen in: <code>{f.evidence}</code></p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.masteryChanges?.length > 0 && (
        <section>
          <h2>How your mirror moved</h2>
          <ul className="moves">
            {a.masteryChanges.map((m, i) => (
              <li key={i}><a href={`#/mirror/${m.node}`}>{m.nodeName}</a> <span className="quiet">{m.facetLabel}</span> <span className={m.to >= m.from ? "st-text-solid" : "st-text-weak"}>{pct(m.from)} → {pct(m.to)}</span></li>
            ))}
          </ul>
        </section>
      )}

      {(r.lastTestcase || r.compileError || r.runtimeError) && a.verdict !== "Accepted" && (
        <section>
          <h2>Failing case</h2>
          {r.lastTestcase && <><p className="quiet small">Input</p><CodeBlock code={r.lastTestcase} /></>}
          {r.expectedOutput && <p className="small">Expected <code>{r.expectedOutput}</code>, got <code>{r.codeOutput || "(empty)"}</code></p>}
          {r.compileError && <CodeBlock code={r.compileError} />}
          {r.runtimeError && <CodeBlock code={r.runtimeError} />}
        </section>
      )}

      <section>
        <h2>Code</h2>
        <CodeBlock code={a.code} />
      </section>
    </section>
  );
}
