import { useMemo } from "react";
import { useLoad, Loading, ErrorNote, FacetStrip, StatusTag, Belt, Meter, FACETS, FACET_LABEL, STATUS_LABEL, pct, lcUrl, timeAgo } from "../ui.jsx";

const SECTION_LABEL = { fundamentals: "Fundamentals", logic_building: "Logic building", faq_medium: "Medium", faq_hard: "Hard" };

export default function Mirror({ path }) {
  const { data, error, loading, reload } = useLoad("/me/overview");
  const selected = decodeURIComponent(path.split("/")[2] ?? "");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const nodes = data.layers.flatMap((l) => l.nodes);
  const node = nodes.find((n) => n.id === selected);
  const s = data.stats;

  return (
    <section className="page page-wide">
      <header className="mirror-head">
        <h1 className="page-title">Mirror</h1>
        <p className="lede">
          {s.solved} of {data.sheet.length} sheet problems solved, {s.submits} submits and {s.runs} runs read.
          {s.streakDays > 1 ? ` ${s.streakDays}-day streak.` : ""}
          {s.cardsDue ? <> <a href="#/revision">{s.cardsDue} revision card{s.cardsDue > 1 ? "s" : ""} due.</a></> : ""}
        </p>
      </header>

      <SheetTrack sheet={data.sheet} />

      <div className={`mirror-body ${node ? "has-detail" : ""}`}>
        <div className="strata" aria-label="Knowledge layers, foundations at the bottom">
          <Legend />
          {[...data.layers].reverse().map((l) => <Stratum key={l.layer} layer={l} selected={selected} />)}
        </div>
        {node && <NodeDetail node={node} nodes={nodes} sheet={data.sheet} />}
      </div>
    </section>
  );
}

function SheetTrack({ sheet }) {
  const sections = [...new Set(sheet.map((p) => p.section))];
  return (
    <section className="track" aria-label="Striver arrays sheet progress">
      <h2>Arrays sheet</h2>
      <div className="track-sections">
        {sections.map((sec) => (
          <div key={sec} className="track-section">
            <span className="track-label">{SECTION_LABEL[sec] ?? sec}</span>
            <div className="track-cells">
              {sheet.filter((p) => p.section === sec).map((p) => {
                const label = `${p.order}. ${p.title}: ${p.status === "new" ? "not started" : p.status}${p.firstTry ? ", first try" : ""}`;
                const cell = <span className={`tcell tc-${p.status}`} title={label} aria-label={label} />;
                return p.slug ? <a key={p.id} href={lcUrl(p.slug)} target="_blank" rel="noreferrer">{cell}</a> : <span key={p.id}>{cell}</span>;
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="quiet small">Filled: solved. Outlined: attempted. Faint: not started. Problems without a LeetCode version can’t be tracked by the extension yet.</p>
    </section>
  );
}

function Legend() {
  return (
    <div className="legend">
      {["weak", "shaky", "solid", "unknown"].map((st) => (
        <span key={st}><span className={`cell st-${st}`} /> {STATUS_LABEL[st]}</span>
      ))}
      <span className="quiet">Each strip reads Recognize, Explain, Implement, Trace, Adapt.</span>
    </div>
  );
}

function Stratum({ layer, selected }) {
  const counts = layer.nodes.reduce((c, n) => ({ ...c, [n.summary.status]: (c[n.summary.status] ?? 0) + 1 }), {});
  return (
    <section className={`stratum stratum-${layer.layer}`}>
      <header>
        <h2>{layer.title}</h2>
        <p className="quiet small">
          {["weak", "shaky", "solid"].filter((k) => counts[k]).map((k) => `${counts[k]} ${STATUS_LABEL[k].toLowerCase()}`).join(", ") || "Nothing seen yet"}
        </p>
      </header>
      <ul className="nodes">
        {layer.nodes.map((n) => (
          <li key={n.id}>
            <a href={`#/mirror/${n.id}`} className={`node node-${n.summary.status}`} aria-current={n.id === selected ? "true" : undefined}>
              <span className="node-name">{n.name}</span>
              <Belt facets={n.facets} />
              <FacetStrip facets={n.facets} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NodeDetail({ node, nodes, sheet }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const dependents = nodes.filter((n) => n.prereqs.includes(node.id));
  const practice = sheet
    .map((p) => ({ p, t: p.nodes.find((x) => x.id === node.id) }))
    .filter((x) => x.t)
    .sort((a, b) => (a.t.role === b.t.role ? a.p.order - b.p.order : a.t.role === "core" ? -1 : 1));

  return (
    <aside className="detail" aria-label={`${node.name} details`}>
      <div className="detail-top">
        <h2>{node.name}</h2>
        <a className="detail-close" href="#/mirror" aria-label="Close details">Close</a>
      </div>
      <p className="detail-belt"><Belt facets={node.facets} withLabel /></p>
      <p><StatusTag status={node.summary.status} />{node.summary.mastery != null && <span className="quiet"> {pct(node.summary.mastery)} overall</span>}</p>
      <p className="detail-desc">{node.description}</p>

      <table className="facets">
        <tbody>
          {FACETS.filter((f) => node.facets[f]).map((f) => {
            const st = node.facets[f];
            return (
              <tr key={f}>
                <th scope="row">{FACET_LABEL[f]}</th>
                <td>
                  <p className="small">{st.criterion}</p>
                  <div className="facet-read">
                    <Meter value={st.mastery} status={st.status} />
                    <span className={`small st-text-${st.status}`}>{st.status === "unknown" ? "Not seen yet" : `${STATUS_LABEL[st.status]} · ${pct(st.mastery)}`}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {node.misconceptionsSeen.length > 0 && (
        <>
          <h3>Mistakes seen in your code</h3>
          <ul className="mis">
            {node.misconceptionsSeen.map((m) => (
              <li key={m.id}>{m.desc}{m.count > 1 && <span className="count">{m.count}×</span>}</li>
            ))}
          </ul>
        </>
      )}

      {node.prereqs.length > 0 && (
        <>
          <h3>Builds on</h3>
          <p className="links">{node.prereqs.map((id) => <NodeLink key={id} n={byId.get(id)} />)}</p>
        </>
      )}
      {dependents.length > 0 && (
        <>
          <h3>Unlocks</h3>
          <p className="links">{dependents.map((n) => <NodeLink key={n.id} n={n} />)}</p>
        </>
      )}
      {practice.length > 0 && (
        <>
          <h3>Sheet problems that use it</h3>
          <ul className="practice">
            {practice.map(({ p, t }) => (
              <li key={p.id}>
                {p.slug ? <a href={lcUrl(p.slug)} target="_blank" rel="noreferrer">{p.title}</a> : p.title}
                <span className="quiet"> {t.role === "core" ? "core" : "supporting"}{p.status !== "new" ? `, ${p.status}` : ""}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function NodeLink({ n }) {
  if (!n) return null;
  return <a href={`#/mirror/${n.id}`} className={`chip chip-${n.summary.status}`}>{n.name}</a>;
}

export { timeAgo };
