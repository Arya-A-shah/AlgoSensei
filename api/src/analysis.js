// LLM grading of one attempt against the knowledge graph, plus auto-tagging of
// problems that are not in any sheet yet.
import { Type } from "@google/genai";
import { graph, buildContextPack, nodeCatalog, FACETS, nodeFacetExists } from "./graph.js";
import { llmJson } from "./llm.js";

const MAX_CODE = 12000;
const clip = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n) + "\n…[truncated]" : s ?? "");

// ---------- schemas (Gemini responseSchema) ----------

const FINDING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    node: { type: Type.STRING },
    facet: { type: Type.STRING, enum: FACETS },
    polarity: { type: Type.STRING, enum: ["positive", "negative"] },
    misconception: { type: Type.STRING, nullable: true },
    evidence: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
  },
  required: ["node", "facet", "polarity", "evidence", "confidence"],
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    approach_level: { type: Type.STRING, enum: ["brute", "better", "optimal", "incomplete"] },
    approach_name: { type: Type.STRING },
    time_complexity: { type: Type.STRING },
    space_complexity: { type: Type.STRING },
    summary: { type: Type.STRING },
    findings: { type: Type.ARRAY, items: FINDING_SCHEMA },
    root_cause: { type: Type.STRING, nullable: true },
  },
  required: ["approach_level", "summary", "findings"],
};

const TAG_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    tier: { type: Type.STRING, enum: ["Basic", "Core", "Pro"] },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          role: { type: Type.STRING, enum: ["core", "supporting"] },
          facets: { type: Type.ARRAY, items: { type: Type.STRING, enum: FACETS } },
        },
        required: ["id", "role", "facets"],
      },
    },
    approaches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          level: { type: Type.STRING, enum: ["brute", "better", "optimal"] },
          name: { type: Type.STRING },
          time: { type: Type.STRING },
          space: { type: Type.STRING },
          demonstrates: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["level", "name", "demonstrates"],
      },
    },
    watch_for: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["summary", "nodes", "approaches"],
};

// ---------- auto-tagging ----------

export async function autoTagProblem({ slug, title, description, apiKey }) {
  const prompt = `You map competitive-programming problems onto a fixed C++ DSA knowledge graph.

PROBLEM (LeetCode slug: ${slug})
Title: ${title}
Description:
${clip(description, 4000)}

KNOWLEDGE GRAPH NODES (id, layer, name, facets):
${JSON.stringify(nodeCatalog(graph))}

MISCONCEPTION IDS YOU MAY LIST IN watch_for (id: description):
${[...graph.misconceptions.values()].map((m) => `${m.id}: ${m.desc}`).join("\n")}

Return JSON:
- summary: one line restating the task.
- tier: Basic | Core | Pro.
- nodes: 1-3 "core" nodes the problem exists to test, plus 2-6 "supporting" nodes it needs. Each with the facets it exercises (only facets that node defines).
- approaches: brute / better / optimal approaches with complexities and the node ids each demonstrates.
- watch_for: up to 8 misconception ids learners most often hit here.
Use only ids from the lists above.`;

  const raw = await llmJson({ apiKey, prompt, schema: TAG_SCHEMA });
  return sanitizeTags(raw, { slug, title });
}

export function sanitizeTags(raw, { slug, title }) {
  const nodes = [];
  const seen = new Set();
  for (const t of raw?.nodes ?? []) {
    const n = graph.nodes.get(t.id);
    if (!n || seen.has(t.id)) continue;
    seen.add(t.id);
    const facets = (t.facets ?? []).filter((f) => n.facets[f]);
    nodes.push({ id: t.id, role: t.role === "core" ? "core" : "supporting", facets: facets.length ? facets : Object.keys(n.facets).slice(0, 1) });
  }
  if (!nodes.some((n) => n.role === "core") && nodes.length) nodes[0].role = "core";
  return {
    id: `lc.${slug}`,
    title,
    tier: ["Basic", "Core", "Pro"].includes(raw?.tier) ? raw.tier : "Core",
    summary: raw?.summary ?? title,
    links: { leetcode: slug },
    autoTagged: true,
    nodes,
    approaches: (raw?.approaches ?? []).map((a) => ({
      level: ["brute", "better", "optimal"].includes(a.level) ? a.level : "optimal",
      name: a.name ?? "Approach",
      time: a.time ?? "",
      space: a.space ?? "",
      demonstrates: (a.demonstrates ?? []).filter((d) => graph.nodes.has(d)),
    })),
    watch_for: (raw?.watch_for ?? []).filter((m) => graph.misconceptions.has(m)),
  };
}

// ---------- attempt analysis ----------

function describeResult(a) {
  const r = a.result ?? {};
  const lines = [`Kind: ${a.kind === "submit" ? "SUBMIT (full hidden test suite)" : "RUN (sample/custom tests)"}`, `Verdict: ${a.verdict}`];
  if (r.totalTestcases) lines.push(`Tests passed: ${r.totalCorrect ?? "?"} / ${r.totalTestcases}`);
  if (r.runtime) lines.push(`Runtime: ${r.runtime}${r.runtimePercentile ? ` (beats ${Math.round(r.runtimePercentile)}%)` : ""}`);
  if (r.compileError) lines.push(`Compile error:\n${clip(r.compileError, 1500)}`);
  if (r.runtimeError) lines.push(`Runtime error:\n${clip(r.runtimeError, 1500)}`);
  if (r.lastTestcase) lines.push(`Failing input:\n${clip(r.lastTestcase, 800)}`);
  if (r.expectedOutput != null && r.expectedOutput !== "") lines.push(`Expected output: ${clip(String(r.expectedOutput), 400)}`);
  if (r.codeOutput != null && r.codeOutput !== "") lines.push(`User output: ${clip(String(r.codeOutput), 400)}`);
  return lines.join("\n");
}

export async function analyzeAttempt({ attempt, problem, progress, apiKey }) {
  const pack = buildContextPack(graph, problem);
  const history = progress
    ? `Before this attempt on this problem: ${progress.runs ?? 0} runs, ${progress.submits ?? 0} submits (${progress.wrongSubmits ?? 0} rejected), ${progress.hints ?? 0} hints requested${progress.maxHintLevel ? ` (deepest hint: level ${progress.maxHintLevel} of 3, where 3 pinpoints the bug)` : ""}.`
    : "First attempt on this problem.";

  const prompt = `You are the grading engine of a C++ DSA learning system. You diagnose WHAT the learner does and does not understand, using a fixed knowledge graph. You do not give hints.

KNOWLEDGE PACK FOR THIS PROBLEM:
${JSON.stringify(pack)}

FACETS: recognize (knows when to use it), explain (knows why it works / its cost), implement (writes it correctly in C++), trace (follows its state), adapt (variants & edge cases).

ATTEMPT:
${describeResult(attempt)}
Language: ${attempt.lang}
${history}

CODE:
\`\`\`
${clip(attempt.code, MAX_CODE)}
\`\`\`

INSTRUCTIONS:
1. Identify which approach the code implements (approach_level, approach_name — reuse a name from the pack when it matches) and its time/space complexity.
2. Produce findings: each is (node, facet, polarity, misconception, evidence, confidence 0..1).
   - Negative findings MUST use a misconception id from the pack that belongs to that node and facet.
   - Attribute failures to the DEEPEST prerequisite that explains them (an off-by-one is u.loop_bounds, not the pattern node).
   - Add positive findings for facets the code clearly demonstrates (correct invariant, correct overflow handling, chosen optimal technique...). On an Accepted optimal solution most findings should be positive.
   - Only judge what the code and verdict actually show. A RUN that passes sample tests is weak evidence. Prefer 2-8 findings.
3. root_cause: the misconception id that best explains a failure, or null.
4. summary: 1-2 sentences addressed to the learner describing what this attempt shows about their understanding. Do NOT reveal the fix or the solution.
Use only ids that appear in the pack.`;

  const raw = await llmJson({ apiKey, prompt, schema: ANALYSIS_SCHEMA });
  return sanitizeAnalysis(raw, pack);
}

// Keeps only ids that exist in the pack; repairs facet mismatches from the misconception definition.
export function sanitizeAnalysis(raw, pack) {
  const allowedNodes = new Set([...pack.tested_nodes.map((n) => n.id), ...pack.prerequisite_nodes.map((n) => n.id)]);
  const findings = [];
  const dropped = [];
  for (const f of raw?.findings ?? []) {
    let { node, facet, polarity, misconception, evidence, confidence } = f;
    const m = misconception ? graph.misconceptions.get(misconception) : null;
    if (polarity === "negative") {
      if (!m) { dropped.push({ ...f, reason: "unknown misconception" }); continue; }
      node = m.node; // the misconception defines where the gap lives
      facet = m.facet;
      if (!allowedNodes.has(node)) { dropped.push({ ...f, reason: "node outside pack" }); continue; }
    } else {
      misconception = null;
      if (!allowedNodes.has(node) || !nodeFacetExists(node, facet)) { dropped.push({ ...f, reason: "unknown node/facet" }); continue; }
    }
    const c = Number(confidence);
    findings.push({
      node,
      facet,
      polarity: polarity === "negative" ? "negative" : "positive",
      misconception: misconception ?? null,
      evidence: String(evidence ?? "").slice(0, 300),
      confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5,
    });
  }
  let rootCause = raw?.root_cause && graph.misconceptions.has(raw.root_cause) ? raw.root_cause : null;
  if (rootCause) {
    const m = graph.misconceptions.get(rootCause);
    if (!allowedNodes.has(m.node)) rootCause = null;
    else if (!findings.some((f) => f.misconception === rootCause)) {
      // The root cause is the most important signal: make sure it counts as evidence.
      findings.push({ node: m.node, facet: m.facet, polarity: "negative", misconception: rootCause, evidence: "identified as root cause", confidence: 0.7 });
    }
  }
  return {
    approachLevel: ["brute", "better", "optimal", "incomplete"].includes(raw?.approach_level) ? raw.approach_level : "incomplete",
    approachName: raw?.approach_name ?? null,
    timeComplexity: raw?.time_complexity ?? null,
    spaceComplexity: raw?.space_complexity ?? null,
    summary: String(raw?.summary ?? "").slice(0, 600),
    findings,
    rootCause,
    dropped,
  };
}
