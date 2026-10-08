// Builds the compact context the grading LLM receives for one problem.
// Shared by the CLI (context-pack.js) and the API server.
import { ancestors } from "./lib.js";

export function buildContextPack(graph, problem) {
  const likely = new Set(problem.watch_for ?? []);
  const tagged = new Map(problem.nodes.map((t) => [t.id, t]));

  // Untagged nodes the grader may still need:
  //   - prerequisites of tagged nodes (root-cause candidates), with their depth
  //   - nodes a brute/better approach demonstrates (the user may write that approach)
  //   - nodes owning a watch_for misconception
  const related = new Map();
  const addRelated = (id, d) => {
    if (!graph.nodes.has(id) || tagged.has(id)) return;
    if (!related.has(id) || related.get(id) > d) related.set(id, d);
  };
  for (const t of problem.nodes) for (const [a, d] of ancestors(graph, t.id)) addRelated(a, d);
  for (const a of problem.approaches ?? []) for (const id of a.demonstrates ?? []) addRelated(id, 0);
  for (const m of problem.watch_for ?? []) {
    const mm = graph.misconceptions.get(m);
    if (mm) addRelated(mm.node, 0);
  }

  const describeMisconceptions = (n) =>
    (n.misconceptions ?? []).map((m) => ({
      id: m.id,
      facet: m.facet,
      desc: m.desc,
      ...(m.signals ? { signals: m.signals } : {}),
      ...(likely.has(m.id) ? { likely: true } : {}),
    }));

  return {
    problem: {
      id: problem.id,
      title: problem.title,
      tier: problem.tier,
      summary: problem.summary,
      approaches: (problem.approaches ?? []).map(({ level, name, time, space, demonstrates }) => ({
        level, name, time, space, demonstrates,
      })),
    },
    tested_nodes: problem.nodes
      .filter((t) => graph.nodes.has(t.id))
      .map((t) => {
        const n = graph.nodes.get(t.id);
        return {
          id: n.id,
          name: n.name,
          role: t.role,
          prereqs: n.prereqs,
          facets: Object.fromEntries(t.facets.filter((f) => n.facets[f]).map((f) => [f, n.facets[f]])),
          misconceptions: describeMisconceptions(n),
        };
      }),
    // depth 0 = related via an approach or the watch-list rather than as a prerequisite
    prerequisite_nodes: [...related]
      .sort((a, b) => a[1] - b[1])
      .map(([id, depth]) => {
        const n = graph.nodes.get(id);
        return { id, name: n.name, depth, misconceptions: describeMisconceptions(n) };
      }),
  };
}

// Compact list of every node, used when a problem is not in any sheet yet and must be auto-tagged.
export function nodeCatalog(graph) {
  return [...graph.nodes.values()].map((n) => ({
    id: n.id,
    layer: n.layer,
    name: n.name,
    facets: Object.keys(n.facets),
  }));
}
