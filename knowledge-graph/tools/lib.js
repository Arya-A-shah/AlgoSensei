// Loads the knowledge graph (nodes/*.json) and problem sets (problems/*.json).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FACETS = ["recognize", "explain", "implement", "trace", "adapt"];
export const ROLES = ["core", "supporting"];
export const LEVELS = ["brute", "better", "optimal"];

const readJsonDir = (dir) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: `${dir}/${f}`, data: JSON.parse(readFileSync(join(ROOT, dir, f), "utf8")) }));

export function loadGraph() {
  const layers = readJsonDir("nodes");
  const nodes = new Map();
  const misconceptions = new Map(); // id -> { ...m, node }
  const duplicates = [];

  for (const { file, data } of layers) {
    for (const n of data.nodes) {
      if (nodes.has(n.id)) duplicates.push(`node ${n.id} (${file})`);
      nodes.set(n.id, { ...n, kind: data.kind, file });
      for (const m of n.misconceptions ?? []) {
        if (misconceptions.has(m.id)) duplicates.push(`misconception ${m.id} (${file})`);
        misconceptions.set(m.id, { ...m, node: n.id });
      }
    }
  }

  const problemSets = readJsonDir("problems");
  const problems = new Map();
  for (const { file, data } of problemSets) {
    for (const p of data.problems) {
      if (problems.has(p.id)) duplicates.push(`problem ${p.id} (${file})`);
      problems.set(p.id, { ...p, sheet: data.sheet, file });
    }
  }

  return { layers, nodes, misconceptions, problems, problemSets, duplicates };
}

// All transitive prerequisites of a node, nearest first, with their depth.
export function ancestors(graph, id) {
  const out = new Map();
  const queue = [[id, 0]];
  while (queue.length) {
    const [cur, d] = queue.shift();
    for (const p of graph.nodes.get(cur)?.prereqs ?? []) {
      if (!out.has(p)) {
        out.set(p, d + 1);
        queue.push([p, d + 1]);
      }
    }
  }
  return out;
}
