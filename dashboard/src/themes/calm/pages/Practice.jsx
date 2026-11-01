import { useState } from "react";
import { api } from "../../../api.js";
import { useLoad, Loading, ErrorNote, CodeBlock, timeUntil, pct, refreshOverview } from "../ui.jsx";
import { FACET, shortName } from "../words.js";

const RATINGS = [
  { value: 1, label: "Again", help: "Couldn't recall" },
  { value: 2, label: "Hard", help: "With effort" },
  { value: 3, label: "Good", help: "Recalled it" },
  { value: 4, label: "Easy", help: "Instantly" },
];

export default function Practice() {
  const { data, error, loading, reload } = useLoad("/me/reviews");
  const [index, setIndex] = useState(0);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const card = data.due[index];
  const total = data.due.length;

  return (
    <section className="page">
      <header className="page-head">
        <h1 className="h1">Practice</h1>
        <p className="counts"><span>{Math.max(0, total - index)} due</span><span>{data.stats.total} in rotation</span></p>
      </header>
      <p className="lede">Concepts you've already shown you know, brought back just before you'd forget them.</p>

      {card ? (
        <>
          <p className="progress-line" aria-label={`Card ${index + 1} of ${total}`}>
            {data.due.map((c, i) => <span key={c.id} className={i < index ? "p-done" : i === index ? "p-now" : ""} />)}
          </p>
          <Card key={card.id} card={card} onGraded={() => { setIndex((i) => i + 1); refreshOverview(); }} />
        </>
      ) : (
        <div className="note">
          <p><b>{index > 0 ? `Done: ${index} reviewed.` : "Nothing due."}</b></p>
          <p className="muted">
            {data.stats.total
              ? data.upcoming[0] ? `Next one ${timeUntil(data.upcoming[0].due)}.` : "Cards return when your recall drops to about 90%."
              : "A concept joins practice once your attempts show it solidly."}
          </p>
          {index > 0 && <button className="btn" onClick={() => { setIndex(0); reload(); }}>Check again</button>}
        </div>
      )}

      {data.upcoming.length > 0 && (
        <>
          <h2 className="h2">Coming up</h2>
          <ul className="queue">
            {data.upcoming.slice(0, 8).map((u) => (
              <li key={u.id}>
                <a href={`#/skills/${u.node}`}>{shortName(u.nodeName)}</a>
                <span className="muted">{FACET[u.facet]?.name}</span>
                <span className="muted queue-when">{timeUntil(u.due)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Card({ card, onGraded }) {
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const p = card.prompt;

  const grade = async (rating) => {
    setSaving(true);
    setErr(null);
    try {
      await api(`/me/reviews/${card.id}`, { method: "POST", body: { rating } });
      onGraded();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <article className="card">
      <header className="card-head">
        <p><a href={`#/skills/${card.node}`}><b>{shortName(card.nodeName)}</b></a> <span className="muted">{FACET[card.facet]?.name}</span></p>
        {card.retrievability != null && <p className="muted">Predicted recall {pct(card.retrievability)}</p>}
      </header>
      <p className="card-q">{p.question}</p>
      <CodeBlock code={p.code} />
      {!shown ? (
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShown(true)}>Show answer</button>
          <span className="muted">Answer it in your head first.</span>
        </div>
      ) : (
        <>
          <p className="card-a">{p.answer}</p>
          <div className="ratings" role="group" aria-label="How well did you recall it?">
            {RATINGS.map((r) => (
              <button key={r.value} className={`rate r-${r.value}`} onClick={() => grade(r.value)} disabled={saving}>
                <b>{r.label}</b><small>{r.help}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </article>
  );
}
