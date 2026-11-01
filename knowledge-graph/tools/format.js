// Rewrites knowledge-graph JSON files in the house style:
// two-space indentation, with prerequisite lists, problem tags and misconceptions kept on one line.
//   node tools/format.js nodes/L3_graphs.json problems/graphs.json
import { readFileSync, writeFileSync } from "node:fs";

const INLINE_ARRAY_KEYS = new Set(["prereqs", "facets"]);
const isScalar = (v) => v === null || typeof v !== "object";
const inlineArray = (a) => `[${a.map((x) => JSON.stringify(x)).join(", ")}]`;
const inlineObject = (o) =>
  `{ ${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${Array.isArray(v) ? inlineArray(v) : JSON.stringify(v)}`).join(", ")} }`;

// A problem tag ({ id, role, facets }) or a misconception ({ id, facet, desc, signals? }).
const isOneLineRecord = (o, parentKey) =>
  (parentKey === "nodes" && "role" in o) || parentKey === "misconceptions";

function fmt(value, indent, key) {
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  if (isScalar(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    if (INLINE_ARRAY_KEYS.has(key) && value.every(isScalar)) return inlineArray(value);
    return `[\n${value.map((v) => inner + (v && typeof v === "object" && !Array.isArray(v) && isOneLineRecord(v, key) ? inlineObject(v) : fmt(v, indent + 2, key))).join(",\n")}\n${pad}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${fmt(v, indent + 2, k)}`).join(",\n")}\n${pad}}`;
}

export const format = (data) => fmt(data, 0, null) + "\n";

for (const file of process.argv.slice(2)) {
  writeFileSync(file, format(JSON.parse(readFileSync(file, "utf8"))));
}
