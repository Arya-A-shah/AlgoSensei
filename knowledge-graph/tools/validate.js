// Validates the knowledge graph and problem tagging.
//   node tools/validate.js            -> checks + stats
//   node tools/validate.js --mermaid  -> also writes graph.mmd (prerequisite DAG)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGraph, ancestors, topics, FACETS, ROLES, LEVELS, ROOT } from "./lib.js";

const g = loadGraph();
const errors = [...g.duplicates.map((d) => `duplicate id: ${d}`)];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---- problem sets (one per A2Z topic) ----
const topicKeys = new Set();
const steps = new Set();
for (const { file, data } of g.problemSets) {
  for (const k of ["sheet", "topic", "topic_title", "step", "sections", "problems"]) {
    if (data[k] === undefined) err(`${file}: missing field '${k}'`);
  }
  if (topicKeys.has(data.topic)) err(`${file}: topic '${data.topic}' used by another problem set`);
  if (steps.has(data.step)) err(`${file}: step ${data.step} used by another problem set`);
  topicKeys.add(data.topic);
  steps.add(data.step);
  const sectionIds = new Set((data.sections ?? []).map((x) => x.id));
  const orders = new Set();
  for (const p of data.problems ?? []) {
    if (!sectionIds.has(p.section)) err(`problem ${p.id}: section '${p.section}' is not listed in ${file}`);
    if (orders.has(p.order)) err(`problem ${p.id}: order ${p.order} repeats within ${file}`);
    orders.add(p.order);
  }
}

// ---- nodes ----
for (const n of g.nodes.values()) {
  const where = `node ${n.id}`;
  for (const k of ["id", "name", "layer", "description", "prereqs", "facets"]) {
    if (n[k] === undefined) err(`${where}: missing field '${k}'`);
  }
  if (n.layer >= 2 && n.layer <= 3) {
    if (!n.topic) err(`${where}: L${n.layer} nodes need a 'topic' (a problem-set topic or 'general')`);
    else if (n.topic !== "general" && !topicKeys.has(n.topic)) err(`${where}: unknown topic '${n.topic}'`);
  }
  const facetKeys = Object.keys(n.facets ?? {});
  if (!facetKeys.length) err(`${where}: no facets`);
  for (const f of facetKeys) if (!FACETS.includes(f)) err(`${where}: unknown facet '${f}'`);

  for (const p of n.prereqs ?? []) {
    const pn = g.nodes.get(p);
    if (!pn) err(`${where}: unknown prereq '${p}'`);
    else if (pn.layer > n.layer) err(`${where} (L${n.layer}): prereq ${p} is in a higher layer (L${pn.layer})`);
  }

  const prefix = n.id.split(".")[0];
  for (const m of n.misconceptions ?? []) {
    if (!m.id || !m.facet || !m.desc) err(`${where}: misconception missing id/facet/desc`);
    if (!facetKeys.includes(m.facet)) err(`${where}: misconception ${m.id} uses facet '${m.facet}' the node does not define`);
    if (!m.id.startsWith(prefix + ".")) warn(`${where}: misconception ${m.id} does not share the node's prefix '${prefix}.'`);
  }
  if (!(n.misconceptions ?? []).length) warn(`${where}: no misconceptions listed`);
}

// ---- cycle check (DFS) ----
const state = new Map(); // 1 = visiting, 2 = done
const visit = (id, path) => {
  if (state.get(id) === 2) return;
  if (state.get(id) === 1) return err(`prerequisite cycle: ${[...path, id].join(" -> ")}`);
  state.set(id, 1);
  for (const p of g.nodes.get(id)?.prereqs ?? []) visit(p, [...path, id]);
  state.set(id, 2);
};
for (const id of g.nodes.keys()) visit(id, []);

// ---- problems ----
const nodeUse = new Map([...g.nodes.keys()].map((k) => [k, { core: 0, supporting: 0 }]));
const miscUse = new Set();
for (const p of g.problems.values()) {
  const where = `problem ${p.id}`;
  const tagged = new Set();
  for (const t of p.nodes ?? []) {
    const n = g.nodes.get(t.id);
    if (!n) { err(`${where}: unknown node '${t.id}'`); continue; }
    if (tagged.has(t.id)) err(`${where}: node ${t.id} tagged twice`);
    tagged.add(t.id);
    if (!ROLES.includes(t.role)) err(`${where}: node ${t.id} has invalid role '${t.role}'`);
    else nodeUse.get(t.id)[t.role]++;
    for (const f of t.facets ?? []) {
      if (!(f in n.facets)) err(`${where}: node ${t.id} has no facet '${f}'`);
    }
  }
  if (!(p.nodes ?? []).some((t) => t.role === "core")) err(`${where}: no core node`);

  for (const a of p.approaches ?? []) {
    if (!LEVELS.includes(a.level)) err(`${where}: approach '${a.name}' has invalid level '${a.level}'`);
    for (const d of a.demonstrates ?? []) {
      if (!g.nodes.has(d)) err(`${where}: approach '${a.name}' demonstrates unknown node '${d}'`);
    }
  }
  if (!(p.approaches ?? []).some((a) => a.level === "optimal")) warn(`${where}: no optimal approach listed`);

  for (const m of p.watch_for ?? []) {
    const mm = g.misconceptions.get(m);
    if (!mm) { err(`${where}: unknown misconception '${m}'`); continue; }
    miscUse.add(m);
    const coveredNode =
      tagged.has(mm.node) ||
      (p.approaches ?? []).some((a) => (a.demonstrates ?? []).includes(mm.node)) ||
      [...tagged].some((t) => ancestors(g, t).has(mm.node));
    if (!coveredNode) warn(`${where}: watches ${m} but its node ${mm.node} is neither tagged nor a prerequisite of a tagged node`);
  }
}

// ---- LeetCode links: attempts are matched by slug, so a slug should map to one problem ----
const bySlug = new Map();
for (const p of [...g.problems.values()].sort((a, b) => (a.step - b.step) || (a.order - b.order))) {
  const slug = p.links?.leetcode;
  if (!slug) continue;
  if (!/^[a-z0-9-]+$/.test(slug)) err(`problem ${p.id}: malformed LeetCode slug '${slug}'`);
  if (bySlug.has(slug)) warn(`LeetCode '${slug}' is linked from ${bySlug.get(slug)} and ${p.id}; attempts are credited to ${bySlug.get(slug)}`);
  else bySlug.set(slug, p.id);
}

// ---- report ----
const byLayer = {};
for (const n of g.nodes.values()) byLayer[n.layer] = (byLayer[n.layer] ?? 0) + 1;
const unused = [...nodeUse].filter(([, u]) => u.core + u.supporting === 0).map(([id]) => id);
const neverCore = [...nodeUse].filter(([, u]) => u.core === 0 && u.supporting > 0).map(([id]) => id);
const unwatched = [...g.misconceptions.keys()].filter((m) => !miscUse.has(m));

console.log(`Nodes: ${g.nodes.size}  (${Object.entries(byLayer).map(([l, c]) => `L${l}: ${c}`).join(", ")})`);
console.log(`Misconceptions: ${g.misconceptions.size}  (${miscUse.size} referenced by problems)`);
console.log(`Problems: ${g.problems.size}  (${topics(g).map((t) => `${t.title}: ${[...g.problems.values()].filter((p) => p.topic === t.topic).length}`).join(", ")})`);
console.log(`LeetCode-linked: ${bySlug.size}`);
if (unused.length) console.log(`\nNodes not tagged on any problem (${unused.length}): ${unused.join(", ")}`);
if (neverCore.length) console.log(`Nodes never 'core' on a problem (${neverCore.length}): ${neverCore.join(", ")}`);
if (unwatched.length) console.log(`Misconceptions no problem watches for (${unwatched.length}): ${unwatched.join(", ")}`);

if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  - ${warnings.join("\n  - ")}`);
if (errors.length) {
  console.error(`\nErrors (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nOK: graph is valid.");

if (process.argv.includes("--mermaid")) {
  const safe = (id) => id.replace(/[^a-zA-Z0-9_]/g, "_");
  const lines = ["flowchart BT"];
  const layerNames = { 0: "L0 Universal", 1: "L1 C++", 2: "L2 Data structures", 3: "L3 Patterns", 4: "L4 Reasoning" };
  for (const layer of Object.keys(byLayer).sort()) {
    lines.push(`  subgraph ${safe("layer" + layer)}["${layerNames[layer] ?? "L" + layer}"]`);
    for (const n of g.nodes.values()) if (String(n.layer) === layer) lines.push(`    ${safe(n.id)}["${n.name}"]`);
    lines.push("  end");
  }
  for (const n of g.nodes.values()) for (const p of n.prereqs) lines.push(`  ${safe(p)} --> ${safe(n.id)}`);
  writeFileSync(join(ROOT, "graph.mmd"), lines.join("\n") + "\n");
  console.log("Wrote graph.mmd");
}
