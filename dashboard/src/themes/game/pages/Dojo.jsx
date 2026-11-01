import { useMemo, useState } from "react";
import { useOverview, Loading, ErrorNote, Bar, pct } from "../ui.jsx";
import { Emblem, Pips, Weapon, Glyph } from "../art.jsx";
import { SCHOOLS, SCHOOL_ORDER, WEAPONS, FACETS, FACET, STATUS, shortName, skillLevel } from "../game.js";

let lastSchool = 3; // remembered while the tab is open

const firstSentence = (s = "") => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

export default function Dojo({ path }) {
  const { data, error, reload } = useOverview();
  const id = decodeURIComponent(path.split("/")[2] ?? "");
  const nodes = useMemo(() => (data ? data.layers.flatMap((l) => l.nodes.map((n) => ({ ...n, layer: l.layer }))) : []), [data]);

  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const node = id ? nodes.find((n) => n.id === id) : null;
  if (node) return <Skill node={node} nodes={nodes} sheet={data.sheet} />;
  return <Rooms nodes={nodes} />;
}

function Rooms({ nodes }) {
  const [school, setSchool] = useState(lastSchool);
  const pick = (s) => { lastSchool = s; setSchool(s); };
  const inSchool = nodes.filter((n) => n.layer === school);
  const count = (layer, st) => nodes.filter((n) => n.layer === layer && n.summary.status === st).length;
  const mastered = nodes.filter((n) => skillLevel(n.facets).mastered).length;
  const weak = nodes.filter((n) => n.summary.status === "weak").length;

  return (
    <section className="page">
      <header className="page-head">
        <h1 className="h-page">Dojo</h1>
        <p className="page-sub">
          <span><b className="num">{mastered}</b> mastered</span>
          <span><b className="num st-weak">{weak}</b> weak</span>
          <span><b className="num">{nodes.length}</b> skills</span>
        </p>
      </header>

      <div className="rooms" role="tablist" aria-label="Dojo rooms">
        {SCHOOL_ORDER.map((l) => (
          <button key={l} role="tab" aria-selected={school === l} className="room" onClick={() => pick(l)}>
            <Glyph name={SCHOOLS[l].glyph} size={20} />
            <span>{SCHOOLS[l].name}</span>
            {count(l, "weak") > 0 && <span className="room-alert" aria-label={`${count(l, "weak")} weak`}>{count(l, "weak")}</span>}
          </button>
        ))}
      </div>
      <p className="room-blurb">{SCHOOLS[school].blurb}</p>

      {school === 2 ? (
        <ul className="armory">
          {inSchool.map((n) => <WeaponCard key={n.id} node={n} />)}
        </ul>
      ) : (
        <ul className="skills">
          {inSchool.map((n) => (
            <li key={n.id}>
              <a href={`#/dojo/${n.id}`} className={`skill sk-${n.summary.status}`}>
                <Emblem node={n} size={56} />
                <span className="skill-name">{shortName(n.name)}</span>
                <Pips facets={n.facets} />
              </a>
            </li>
          ))}
        </ul>
      )}
      <Legend />
    </section>
  );
}

function WeaponCard({ node }) {
  const w = WEAPONS[node.id];
  const lvl = skillLevel(node.facets);
  return (
    <li>
      <a href={`#/dojo/${node.id}`} className={`weapon-card wc-${node.summary.status}`}>
        <span className="weapon-stage"><Weapon id={node.id} size={96} /></span>
        <span className="weapon-name">{w?.weapon ?? shortName(node.name)}</span>
        <span className="weapon-ds">{node.name}</span>
        <span className="weapon-line">{w?.line}</span>
        <span className="weapon-foot">
          <Pips facets={node.facets} />
          <span className="weapon-lvl">{lvl.seen ? `${lvl.solid}/${lvl.total} solid` : "Not drawn yet"}</span>
        </span>
      </a>
    </li>
  );
}

function Legend() {
  return (
    <p className="legend" aria-label="Legend">
      {["weak", "shaky", "solid", "unknown"].map((st) => (
        <span key={st}><span className={`pip pip-${st}`} /> {STATUS[st].name}</span>
      ))}
      <span className="legend-note">Pips, left to right: Spot, Explain, Code, Trace, Adapt</span>
    </p>
  );
}

function Skill({ node, nodes, sheet }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lvl = skillLevel(node.facets);
  const needs = node.prereqs.map((id) => byId.get(id)).filter(Boolean);
  const unlocks = nodes.filter((n) => n.prereqs.includes(node.id));
  const train = sheet
    .map((p) => ({ p, t: p.nodes.find((x) => x.id === node.id) }))
    .filter((x) => x.t)
    .sort((a, b) => (a.t.role === b.t.role ? a.p.order - b.p.order : a.t.role === "core" ? -1 : 1));
  const w = WEAPONS[node.id];

  return (
    <section className="page skill-page">
      <a className="back" href="#/dojo">Dojo</a>
      <header className={`skill-hero sh-${node.summary.status}`}>
        {w ? <span className="skill-hero-art"><Weapon id={node.id} size={120} /></span> : <Emblem node={node} size={104} />}
        <div>
          <p className="skill-school">{SCHOOLS[node.layer].name}</p>
          <h1 className="h-page">{w ? w.weapon : shortName(node.name)}</h1>
          <p className="skill-sub">{w ? node.name : firstSentence(node.description)}</p>
          <p className="skill-status">
            <span className={`status-chip sc-${node.summary.status}`}>{STATUS[node.summary.status].name}</span>
            {lvl.seen && <span><b className="num">{lvl.solid}</b>/{lvl.total} solid</span>}
            {node.summary.mastery != null && <span><b className="num">{pct(node.summary.mastery)}</b> mastery</span>}
          </p>
        </div>
      </header>

      <h2 className="h-section">Tests</h2>
      <ul className="facets">
        {FACETS.filter((f) => node.facets[f]).map((f) => {
          const st = node.facets[f];
          return (
            <li key={f} className={`facet fc-${st.status}`}>
              <span className="facet-name">{FACET[f].name}</span>
              <span className="facet-what">{FACET[f].what}</span>
              <Bar value={st.mastery} status={st.status} />
              <span className="facet-st">{st.status === "unknown" ? "–" : pct(st.mastery)}</span>
            </li>
          );
        })}
      </ul>

      {node.misconceptionsSeen.length > 0 && (
        <>
          <h2 className="h-section">Hits you took</h2>
          <ul className="hits">
            {node.misconceptionsSeen.slice(0, 4).map((m) => (
              <li key={m.id}><span className="hit-count">{m.count}×</span>{m.desc}</li>
            ))}
          </ul>
        </>
      )}

      {train.length > 0 && (
        <>
          <h2 className="h-section">Train on</h2>
          <ul className="mini-tiles">
            {train.slice(0, 8).map(({ p, t }) => (
              <li key={p.id}>
                <a href={`#/p/${p.id}`} className={`ptile pt-${p.status}`} title={`${p.title}${t.role === "core" ? ": main skill" : ""}`}>
                  <span className="ptile-num">{p.order}</span>
                  <span className="ptile-name">{p.title}</span>
                  {t.role === "core" && <span className="ptile-core" aria-label="main skill">★</span>}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {(needs.length > 0 || unlocks.length > 0) && (
        <div className="tree">
          {needs.length > 0 && (
            <div>
              <h2 className="h-section">Needs</h2>
              <p className="chips">{needs.map((n) => <SkillChip key={n.id} n={n} />)}</p>
            </div>
          )}
          {unlocks.length > 0 && (
            <div>
              <h2 className="h-section">Unlocks</h2>
              <p className="chips">{unlocks.map((n) => <SkillChip key={n.id} n={n} />)}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SkillChip({ n }) {
  return (
    <a href={`#/dojo/${n.id}`} className={`chip chip-${n.summary.status}`}>
      {n.layer === 2 ? <Weapon id={n.id} size={16} /> : <Glyph name={SCHOOLS[n.layer].glyph} size={14} />}
      {WEAPONS[n.id]?.weapon ?? shortName(n.name)}
    </a>
  );
}
