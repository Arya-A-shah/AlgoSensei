// Loads the knowledge graph once and exposes lookups the services need.
import { loadGraph, ancestors, topics, bySheetOrder, FACETS } from "../../knowledge-graph/tools/lib.js";
import { buildContextPack, nodeCatalog } from "../../knowledge-graph/tools/pack.js";

export const graph = loadGraph();
export { ancestors, buildContextPack, nodeCatalog, FACETS };

// Every sheet problem in learning order: A2Z step, then position within the step.
export const sheetProblems = [...graph.problems.values()].sort(bySheetOrder);

// Topics (one per problem set) with their sections, in A2Z order.
export const topicList = topics(graph);

// LeetCode slug -> sheet problem. If two sheet problems share a LeetCode problem,
// attempts are credited to the earlier one.
export const problemBySlug = new Map();
for (const p of sheetProblems) {
  if (p.links?.leetcode && !problemBySlug.has(p.links.leetcode)) problemBySlug.set(p.links.leetcode, p);
}

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
  return out.sort((a, b) => (a.role === b.role ? bySheetOrder(a.problem, b.problem) : a.role === "core" ? -1 : 1));
}
