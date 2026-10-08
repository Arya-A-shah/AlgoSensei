// Loads the knowledge graph once and exposes lookups the services need.
import { loadGraph, ancestors, FACETS } from "../../knowledge-graph/tools/lib.js";
import { buildContextPack, nodeCatalog } from "../../knowledge-graph/tools/pack.js";

export const graph = loadGraph();
export { ancestors, buildContextPack, nodeCatalog, FACETS };

// LeetCode slug -> sheet problem
export const problemBySlug = new Map();
for (const p of graph.problems.values()) {
  if (p.links?.leetcode) problemBySlug.set(p.links.leetcode, p);
}

export const sheetProblems = [...graph.problems.values()].sort((a, b) => a.order - b.order);

export const FACET_LABEL = {
  recognize: "Recognize",
  explain: "Explain",
  implement: "Implement",
  trace: "Trace",
  adapt: "Adapt",
};

// Bloom's level each facet maps to (used for review cards).
export const FACET_BLOOM = {
  recognize: "Analyze",
  explain: "Understand",
  implement: "Apply",
  trace: "Apply",
  adapt: "Evaluate",
};

export function nodeFacetExists(node, facet) {
  return Boolean(graph.nodes.get(node)?.facets?.[facet]);
}

// Problems where a node is tagged, core first.
export function problemsForNode(nodeId) {
  const out = [];
  for (const p of sheetProblems) {
    const t = p.nodes.find((n) => n.id === nodeId);
    if (t) out.push({ problem: p, role: t.role, facets: t.facets });
  }
  return out.sort((a, b) => (a.role === b.role ? a.problem.order - b.problem.order : a.role === "core" ? -1 : 1));
}
