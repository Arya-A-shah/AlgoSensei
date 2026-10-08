import { useState } from "react";
import { api } from "../api.js";
import { useLoad, Loading, ErrorNote, CodeBlock, timeUntil, pct } from "../ui.jsx";

const RATINGS = [
  { value: 1, label: "Again", help: "I couldn’t do it" },
  { value: 2, label: "Hard", help: "Got there with effort" },
  { value: 3, label: "Good", help: "Recalled it" },
  { value: 4, label: "Easy", help: "Instant" },
];

export default function Revision() {
  const { data, error, loading, reload } = useLoad("/me/reviews");
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const card = data.due[index];

  return (
    <section className="page">
      <h1 className="page-title">Revision</h1>
      <p className="lede">
        Concepts you’ve already shown you understand, scheduled just before you’d forget them.
        {data.stats.total ? ` ${data.stats.total} in rotation.` : ""}
      </p>

      {card ? (
        <ReviewCard
          key={card.id}
          card={card}
          position={`${index + 1} of ${data.due.length}`}
          onGraded={() => { setDone((d) => d + 1); setIndex((i) => i + 1); }}
        />
      ) : (
        <div className="empty">
          {done > 0 ? <p>Done for now: {done} card{done > 1 ? "s" : ""} reviewed.</p> : <p>Nothing is due.</p>}
          <p className="quiet">
            {data.stats.total
              ? "Cards come back when your predicted recall drops to about 90%."
              : "A concept joins revision once your attempts show it solidly. Keep solving and fixing gaps."}
          </p>
          {done > 0 && <button className="btn" onClick={() => { setIndex(0); setDone(0); reload(); }}>Check again</button>}
        </div>
      )}

      {data.upcoming.length > 0 && (
        <section className="upcoming">
          <h2>Coming up</h2>
          <ul className="rows compact">
            {data.upcoming.map((u) => (
              <li key={u.id} className="row">
                <div className="row-body"><a href={`#/mirror/${u.node}`}>{u.nodeName}</a> <span className="quiet">· {u.facetLabel}</span></div>
                <span className="quiet">{timeUntil(u.due)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function ReviewCard({ card, position, onGraded }) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const p = card.prompt;

  const grade = async (rating) => {
    setSaving(true);
    setErr(null);
    try {
      await api(`/me/reviews/${card.id}`, { method: "POST", body: { rating, answer } });
      onGraded();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <article className="card">
      <header className="card-head">
        <p><a href={`#/mirror/${card.node}`}>{card.nodeName}</a> <span className="quiet">· {card.facetLabel}, Bloom’s level: {card.bloom}</span></p>
        <p className="quiet small">{position}{card.retrievability != null ? `, predicted recall ${pct(card.retrievability)}` : ""}</p>
      </header>
      <p className="card-q">{p.question}</p>
      <CodeBlock code={p.code} />
      <label className="field">
        <span>Your answer (optional, for yourself)</span>
        <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Think it through or write it down before revealing." />
      </label>
      {!revealed ? (
        <button className="btn btn-primary" onClick={() => setRevealed(true)}>Show answer</button>
      ) : (
        <>
          <div className="answer"><p>{p.answer}</p></div>
          <p className="quiet small">How well did you know it?</p>
          <div className="ratings" role="group" aria-label="Rate your recall">
            {RATINGS.map((r) => (
              <button key={r.value} className={`rate rate-${r.value}`} onClick={() => grade(r.value)} disabled={saving}>
                <strong>{r.label}</strong><span>{r.help}</span>
              </button>
            ))}
          </div>
          {err && <p className="st-text-weak">{err}</p>}
        </>
      )}
      {p.generatedBy === "template" && <p className="quiet small">This is an outline card. Add a Gemini key in Settings for generated questions.</p>}
    </article>
  );
}
