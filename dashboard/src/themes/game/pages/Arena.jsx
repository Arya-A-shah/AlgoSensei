import { useState } from "react";
import { api } from "../../../api.js";
import { useLoad, Loading, ErrorNote, CodeBlock, timeUntil, pct, refreshOverview } from "../ui.jsx";
import { Glyph } from "../art.jsx";
import { FACET, shortName } from "../game.js";

const RATINGS = [
  { value: 1, label: "Missed", help: "Couldn't do it" },
  { value: 2, label: "Barely", help: "With effort" },
  { value: 3, label: "Got it", help: "Recalled it" },
  { value: 4, label: "Easy", help: "Instant" },
];

export default function Arena() {
  const { data, error, loading, reload } = useLoad("/me/reviews");
  const [index, setIndex] = useState(0);
  const [won, setWon] = useState(0);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const card = data.due[index];
  const total = data.due.length;

  return (
    <section className="page arena">
      <header className="page-head">
        <h1 className="h-page">Arena</h1>
        <p className="page-sub">
          <span><b className="num">{Math.max(0, total - index)}</b> to spar</span>
          <span><b className="num">{data.stats.total}</b> skills in rotation</span>
        </p>
      </header>

      {card ? (
        <>
          <div className="round-dots" aria-label={`Round ${index + 1} of ${total}`}>
            {data.due.map((c, i) => <span key={c.id} className={i < index ? "dot-done" : i === index ? "dot-now" : ""} />)}
          </div>
          <Bout key={card.id} card={card} onGraded={(rating) => { if (rating > 1) setWon((w) => w + 1); setIndex((i) => i + 1); refreshOverview(); }} />
        </>
      ) : (
        <div className="arena-empty">
          <Glyph name="mind" size={44} />
          {index > 0 ? (
            <>
              <p className="arena-big">{won} of {index} won.</p>
              <p>Rest. They come back right before you'd forget.</p>
              <button className="btn btn-ink" onClick={() => { setIndex(0); setWon(0); reload(); }}>Check again</button>
            </>
          ) : (
            <>
              <p className="arena-big">No one to spar.</p>
              <p>{data.stats.total ? `Next opponent ${data.upcoming[0] ? timeUntil(data.upcoming[0].due) : "soon"}.` : "A skill enters the arena once your fights show it's solid."}</p>
            </>
          )}
        </div>
      )}

      {data.upcoming.length > 0 && (
        <>
          <h2 className="h-section">Coming up</h2>
          <ul className="queue">
            {data.upcoming.slice(0, 8).map((u) => (
              <li key={u.id}>
                <a href={`#/dojo/${u.node}`}>{shortName(u.nodeName)}</a>
                <small>{FACET[u.facet]?.name}</small>
                <span>{timeUntil(u.due)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Bout({ card, onGraded }) {
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const p = card.prompt;
  const recall = card.retrievability ?? 1;

  const grade = async (rating) => {
    setSaving(true);
    setErr(null);
    try {
      await api(`/me/reviews/${card.id}`, { method: "POST", body: { rating } });
      onGraded(rating);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <article className="bout">
      <header className="bout-head">
        <div>
          <a className="bout-skill" href={`#/dojo/${card.node}`}>{shortName(card.nodeName)}</a>
          <span className="bout-facet">{FACET[card.facet]?.name}: {FACET[card.facet]?.what.toLowerCase()}</span>
        </div>
        <div className="hp" title={`Predicted recall ${pct(recall)}`}>
          <span className="hp-label">Recall</span>
          <span className="hp-bar"><span className={`hp-fill ${recall < 0.8 ? "hp-low" : ""}`} style={{ width: pct(recall) }} /></span>
          <b className="num">{pct(recall)}</b>
        </div>
      </header>
      <div className="scroll">
        <p className="scroll-q">{p.question}</p>
        <CodeBlock code={p.code} />
        {revealed && <div className="scroll-answer"><p>{p.answer}</p></div>}
        {!revealed && (
          <div className="scroll-actions">
            <button className="btn btn-strike" onClick={() => setRevealed(true)}>Reveal answer</button>
            <span className="scroll-small">Answer in your head first.</span>
          </div>
        )}
      </div>
      {revealed && (
        <div className="ratings" role="group" aria-label="How did you do?">
          {RATINGS.map((r) => (
            <button key={r.value} className={`rate rate-${r.value}`} onClick={() => grade(r.value)} disabled={saving}>
              <b>{r.label}</b><small>{r.help}</small>
            </button>
          ))}
        </div>
      )}
      {err && <p className="st-weak">{err}</p>}
    </article>
  );
}
