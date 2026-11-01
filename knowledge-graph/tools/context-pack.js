// Builds the compact context the analysis LLM receives for one problem.
//   node tools/context-pack.js arr.two_sum
//   node tools/context-pack.js --list
//
// The pack contains:
//   - the problem, its approaches, and its tagged nodes with facet criteria
//   - every misconception the grader may choose from (tagged nodes + their prerequisites),
//     with the problem's watch_for list flagged as 'likely'
//   - the prerequisite chain, so the grader can attribute a failure to a deeper root cause
//   - the exact JSON shape the grader must return
import { loadGraph, bySheetOrder } from "./lib.js";
import { buildContextPack } from "./pack.js";

const g = loadGraph();
const arg = process.argv[2];

if (!arg || arg === "--list") {
  let topic = null;
  for (const p of [...g.problems.values()].sort(bySheetOrder)) {
    if (p.topic !== topic) console.log(`\n${(topic = p.topic, p.topicTitle)} (A2Z step ${p.step})`);
    console.log(`${String(p.order).padStart(2)}  ${p.id.padEnd(34)} ${p.tier.padEnd(5)}  ${p.title}`);
  }
  process.exit(0);
}

const p = g.problems.get(arg);
if (!p) {
  console.error(`Unknown problem '${arg}'. Run with --list.`);
  process.exit(1);
}

const pack = {
  ...buildContextPack(g, p),
  response_format: {
    approach_level: "brute | better | optimal | incomplete",
    approach_name: "string (match problem.approaches[].name when possible)",
    findings: [
      {
        node: "node id from tested_nodes or prerequisite_nodes",
        facet: "recognize | explain | implement | trace | adapt",
        polarity: "positive | negative",
        misconception: "misconception id (required when polarity is negative, null otherwise)",
        evidence: "short quote of the code line / verdict / failing input that supports this",
        confidence: "0..1",
      },
    ],
    root_cause: "misconception id of the deepest failing prerequisite, or null if accepted cleanly",
  },
  rules: [
    "Only use node, facet and misconception ids that appear in this pack.",
    "Prefer the deepest prerequisite that explains the failure (e.g. an off-by-one in u.loop_bounds over a pattern-level misconception).",
    "Emit positive findings for facets the code clearly demonstrates, not just negatives.",
    "Never reveal the solution; this output is for grading, not for the user.",
  ],
};

console.log(JSON.stringify(pack, null, 2));
