import { useEffect, useRef, useState } from "react";
import { useLoad, Loading, ErrorNote, CodeBlock, useOverview } from "../ui.jsx";
import { Backdrop, Sensei, Student } from "../art.jsx";
import { senseiLine, MOVE_TAG, beltRank } from "../game.js";

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Types the line out once, like dialogue in a game. Click or reduced motion shows it whole.
function useTypewriter(text) {
  const [n, setN] = useState(reduceMotion() ? text.length : 0);
  useEffect(() => {
    if (reduceMotion()) { setN(text.length); return; }
    setN(0);
    const id = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(id), k) : k + 1)), 22);
    return () => clearInterval(id);
  }, [text]);
  return [text.slice(0, n), n >= text.length, () => setN(text.length)];
}

export default function Home() {
  const { data, error, loading, reload } = useLoad("/me/next");
  const { data: ov } = useOverview();
  const [pick, setPick] = useState(0);
  const [drillOpen, setDrillOpen] = useState(false);
  const drillRef = useRef(null);

  useEffect(() => { setDrillOpen(false); }, [pick]);
  useEffect(() => { if (drillOpen) drillRef.current?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); }, [drillOpen]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const moves = data.moves;
  const move = moves[pick] ?? null;
  const line = senseiLine(move);
  const belt = ov ? beltRank(ov.stats.solved, ov.sheet.length) : null;

  return (
    <div className="home">
      <section className="scene" aria-label="Sensei">
        <Backdrop />
        <div className="scene-cast">
          <Sensei />
          <Speech key={pick} line={line} move={move} onDrill={() => setDrillOpen(true)} />
          <Student className="scene-student" belt={belt?.color} />
        </div>
      </section>

      {drillOpen && move?.type === "fix" && (
        <section className="drill-wrap" ref={drillRef} aria-label="Drill">
          <Drill drill={move.detail.drill} move={move} />
        </section>
      )}

      {moves.length > 1 && (
        <section className="moves" aria-label="What the sensei suggests">
          <h2 className="h-section">Orders</h2>
          <ul className="move-list">
            {moves.map((m, i) => (
              <li key={i}>
                <button className={`move m-${m.type}`} aria-pressed={i === pick} onClick={() => setPick(i)}>
                  <span className={`move-tag tag-${m.type}`}>{MOVE_TAG[m.type]}</span>
                  <span className="move-say">{senseiLine(m).say}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Speech({ line, move, onDrill }) {
  const [shown, done, skip] = useTypewriter(line.say);
  return (
    <div className="speech" onClick={skip}>
      <p className="speech-say" aria-live="polite">
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{line.say}</span>
        {!done && <span className="caret" aria-hidden="true" />}
      </p>
      {line.why && <p className={`speech-why ${done ? "in" : ""}`}>{line.why}</p>}
      {line.act && (
        <div className={`speech-act ${done ? "in" : ""}`}>
          {line.act.kind === "drill" ? (
            <button className="btn btn-strike" onClick={(e) => { e.stopPropagation(); onDrill(); }}>{line.act.label}</button>
          ) : (
            <a className="btn btn-strike" href={line.act.href} {...(line.act.external ? { target: "_blank", rel: "noreferrer" } : {})}>{line.act.label}</a>
          )}
          {move?.type === "fix" && <a className="btn btn-ghost" href={`#/dojo/${move.detail.node}`}>See skill</a>}
        </div>
      )}
    </div>
  );
}

function Drill({ drill, move }) {
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(false);
  const practice = move.detail.practice ?? [];
  if (!drill) return null;
  return (
    <article className="scroll">
      <p className="scroll-kicker">Drill</p>
      <p className="scroll-q">{drill.question}</p>
      <CodeBlock code={drill.code} />
      {hint && !shown && <p className="scroll-hint">{drill.hint}</p>}
      {shown && <div className="scroll-answer"><p>{drill.answer}</p></div>}
      <div className="scroll-actions">
        {!shown && <button className="btn btn-strike" onClick={() => setShown(true)}>Reveal answer</button>}
        {!shown && drill.hint && !hint && <button className="btn btn-ink" onClick={() => setHint(true)}>Hint</button>}
      </div>
      {practice.length > 0 && (
        <p className="scroll-then">
          Then fight:{" "}
          {practice.map((p, i) => (
            <span key={p.id}>{i > 0 && ", "}<a href={`#/p/${p.id}`}>{p.title}</a></span>
          ))}
        </p>
      )}
      {drill.generatedBy === "template" && <p className="scroll-small">Add a Gemini key in Settings for a sharper drill.</p>}
    </article>
  );
}
