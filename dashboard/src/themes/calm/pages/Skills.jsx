import { useMemo, useState } from "react";
import { useOverview, Loading, ErrorNote, Bar, pct } from "../ui.jsx";
import { Dots, Belt } from "../art.jsx";
import { LAYERS, LAYER_ORDER, FACETS, FACET, STATUS, shortName, beltFor } from "../words.js";

let lastLayer = 3;
const firstSentence = (s = "") => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

export default function Skills({ path }) {
  const { data, error, reload } = useOverview();
  const id = decodeURIComponent(path.split("/")[2] ?? "");
  const nodes = useMemo(() => (data ? data.layers.flatMap((l) => l.nodes.map((n) => ({ ...n, layer: l.layer }))) : []), [data]);
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const node = id ? nodes.find((n) => n.id === id) : null;
  return node ? <Concept node={node} nodes={nodes} sheet={data.sheet} /> : <ConceptList nodes={nodes} />;
}

function ConceptList({ nodes }) {
  const [layer, setLayer] = useState(lastLayer);
  const pick = (l) => { lastLayer = l; setLayer(l); };
  const count = (st, l) => nodes.filter((n) => (l == null || n.layer === l) && n.summary.status === st).length;
  const shown = nodes.filter((n) => n.layer === layer);

  return (
    <section className="page">
      <header className="page-head">
        <h1 className="h1">Skills</h1>
        <p className="counts">
          <span className="cnt-solid">{count("solid")} solid</span>
          <span className="cnt-shaky">{count("shaky")} shaky</span>
          <span className="cnt-weak">{count("weak")} weak</span>
        </p>
      </header>

      <div className="tabs" role="tablist" aria-label="Concept groups">
        {LAYER_ORDER.map((l) => (
          <button key={l} role="tab" aria-selected={layer === l} className="tab" onClick={() => pick(l)}>
            {LAYERS[l].name}
            {count("weak", l) > 0 && <span className="tab-weak" aria-label={`${count("weak", l)} weak`}>{count("weak", l)}</span>}
          </button>
        ))}
      </div>
      <p className="lede">{LAYERS[layer].blurb}</p>

      <ul className="concepts">
        {shown.map((n) => (
          <li key={n.id}>
            <a href={`#/skills/${n.id}`} className={`concept c-${n.summary.status}`}>
              <span className="concept-top">
                <span className="concept-name">{shortName(n.name)}</span>
                {beltFor(n.facets)?.solid > 0 && <Belt belt={beltFor(n.facets)} />}
              </span>
              <Bar value={n.summary.mastery} status={n.summary.status} />
              <span className="concept-foot">
                <Dots facets={n.facets} />
                <span>{n.summary.status === "unknown" ? "Not seen" : `${STATUS[n.summary.status].name} · ${pct(n.summary.mastery)}`}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="legend">
        {["weak", "shaky", "solid", "unknown"].map((st) => <span key={st}><span className={`dot d-${st}`} /> {STATUS[st].name}</span>)}
        <span>Dots: Recognize, Explain, Implement, Trace, Adapt</span>
      </p>
    </section>
  );
}

function Concept({ node, nodes, sheet }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const belt = beltFor(node.facets);
  const needs = node.prereqs.map((id) => byId.get(id)).filter(Boolean);
  const unlocks = nodes.filter((n) => n.prereqs.includes(node.id));
  const practice = sheet
    .map((p) => ({ p, t: p.nodes.find((x) => x.id === node.id) }))
    .filter((x) => x.t)
    .sort((a, b) => (a.t.role === b.t.role ? a.p.order - b.p.order : a.t.role === "core" ? -1 : 1));

  return (
    <section className="page">
      <a className="back" href="#/skills">Skills</a>
      <header className="detail-head">
        <p className="eyebrow">{LAYERS[node.layer].name}</p>
        <h1 className="h1">{shortName(node.name)}</h1>
        <p className="lede">{firstSentence(node.description)}</p>
        <p className="detail-status">
          <span className={`chip-status s-${node.summary.status}`}>{STATUS[node.summary.status].name}</span>
          {node.summary.mastery != null && <span>{pct(node.summary.mastery)} mastery</span>}
          {belt && <span className="belt-line"><Belt belt={belt} /> {belt.name} belt, {belt.solid} of {belt.total} solid</span>}
        </p>
      </header>

      <ul className="facets">
        {FACETS.filter((f) => node.facets[f]).map((f) => {
          const st = node.facets[f];
          return (
            <li key={f} className={`facet f-${st.status}`}>
              <span className="facet-name">{FACET[f].name}</span>
              <span className="facet-what">{FACET[f].what}</span>
              <Bar value={st.mastery} status={st.status} />
              <span className="facet-pct">{st.status === "unknown" ? "–" : pct(st.mastery)}</span>
            </li>
          );
        })}
      </ul>

      {node.misconceptionsSeen.length > 0 && (
        <>
          <h2 className="h2">Mistakes seen in your code</h2>
          <ul className="mistakes">
            {node.misconceptionsSeen.slice(0, 5).map((m) => (
              <li key={m.id}>{m.desc}{m.count > 1 && <span className="times">{m.count}×</span>}</li>
            ))}
          </ul>
        </>
      )}

      {practice.length > 0 && (
        <>
          <h2 className="h2">Practise on</h2>
          <ul className="tiles-inline">
            {practice.slice(0, 8).map(({ p, t }) => (
              <li key={p.id}>
                <a href={`#/p/${p.id}`} className={`tile t-${p.status}`} title={t.role === "core" ? "Main concept of this problem" : "Used in this problem"}>
                  <span className="tile-num">{p.order}</span>
                  <span className="tile-name">{p.title}</span>
                  {t.role === "core" && <span className="tile-core">main</span>}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {(needs.length > 0 || unlocks.length > 0) && (
        <div className="two-col">
          {needs.length > 0 && (
            <div>
              <h2 className="h2">Builds on</h2>
              <p className="chips">{needs.map((n) => <ConceptChip key={n.id} n={n} />)}</p>
            </div>
          )}
          {unlocks.length > 0 && (
            <div>
              <h2 className="h2">Leads to</h2>
              <p className="chips">{unlocks.map((n) => <ConceptChip key={n.id} n={n} />)}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function ConceptChip({ n }) {
  return <a href={`#/skills/${n.id}`} className={`chip s-${n.summary.status}`}><span className={`dot d-${n.summary.status}`} />{shortName(n.name)}</a>;
}
