import { useEffect, useRef, useState } from "react";
import { useLoad, useOverview, Loading, ErrorNote, CodeBlock, pct } from "../ui.jsx";
import { Sensei, Scroll, Dots } from "../art.jsx";
import { instruction, MOVE_LABEL, shortName } from "../words.js";

export default function Home() {
  const { data, error, loading, reload } = useLoad("/me/next");
  const { data: ov } = useOverview();
  const [pick, setPick] = useState(0);
  const [drill, setDrill] = useState(false);
  const drillRef = useRef(null);

  useEffect(() => setDrill(false), [pick]);
  useEffect(() => { if (drill) drillRef.current?.scrollIntoView({ block: "nearest" }); }, [drill]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const moves = data.moves;
  const move = moves[pick] ?? null;
  const line = instruction(move);

  const weakest = ov
    ? ov.layers.flatMap((l) => l.nodes).filter((n) => n.summary.status === "weak").sort((a, b) => a.summary.mastery - b.summary.mastery).slice(0, 5)
    : [];

  return (
    <div className="home">
      <section className="sensei-card" aria-label="Sensei">
        <Sensei size={92} />
        <div className="sensei-words">
          <p className="say" aria-live="polite">{line.say}</p>
          {line.why && <p className="why">{line.why}</p>}
          {line.act && (
            <div className="actions">
              {line.act.kind === "drill" ? (
                <button className="btn btn-primary" onClick={() => setDrill(true)} aria-expanded={drill}>{line.act.label}</button>
              ) : (
                <a className="btn btn-primary" href={line.act.href} {...(line.act.external ? { target: "_blank", rel: "noreferrer" } : {})}>{line.act.label}</a>
              )}
              {move?.type === "fix" && <a className="btn" href={`#/skills/${move.detail.node}`}>See concept</a>}
            </div>
          )}
        </div>
      </section>

      {drill && move?.type === "fix" && (
        <div ref={drillRef}>
          <Drill drill={move.detail.drill} detail={move.detail} />
        </div>
      )}

      <div className="home-grid">
        {moves.length > 1 && (
          <section aria-labelledby="next-h">
            <h2 id="next-h" className="h2">Up next</h2>
            <ul className="moves">
              {moves.map((m, i) => (
                <li key={i}>
                  <button className="move" aria-pressed={i === pick} onClick={() => setPick(i)}>
                    <span className={`tag tag-${m.type}`}>{MOVE_LABEL[m.type]}</span>
                    <span>{instruction(m).say}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {weakest.length > 0 && (
          <section aria-labelledby="weak-h">
            <h2 id="weak-h" className="h2">Weakest concepts</h2>
            <ul className="weak-list">
              {weakest.map((n) => (
                <li key={n.id}>
                  <a href={`#/skills/${n.id}`}>
                    <span className="weak-name">{shortName(n.name)}</span>
                    <Dots facets={n.facets} />
                    <span className="weak-pct">{pct(n.summary.mastery)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Drill({ drill, detail }) {
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(false);
  if (!drill) return null;
  const practice = detail.practice ?? [];
  return (
    <Scroll className="drill" label="Drill">
      <p className="scroll-title">Drill: {shortName(detail.nodeName)}</p>
      <p className="scroll-q">{drill.question}</p>
      <CodeBlock code={drill.code} />
      {hint && !shown && <p className="scroll-hint">{drill.hint}</p>}
      {shown && <p className="scroll-answer">{drill.answer}</p>}
      <div className="actions">
        {!shown && <button className="btn btn-primary" onClick={() => setShown(true)}>Show answer</button>}
        {!shown && drill.hint && !hint && <button className="btn" onClick={() => setHint(true)}>Hint</button>}
      </div>
      {practice.length > 0 && (
        <p className="scroll-then">
          Then solve{" "}
          {practice.map((p, i) => <span key={p.id}>{i > 0 && " or "}<a href={`#/p/${p.id}`}>{p.title}</a></span>)}.
        </p>
      )}
      {drill.generatedBy === "template" && <p className="scroll-small">Add a Gemini key in Settings for a sharper drill.</p>}
    </Scroll>
  );
}
