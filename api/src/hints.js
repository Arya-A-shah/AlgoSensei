// Graph-aware Socratic hints, delivered as a ladder:
//   1 Nudge     where to look, as questions; no technique or concept names
//   2 Concept   names the concept / invariant at stake and asks the learner to check against it
//   3 Pinpoint  points at the exact region of their code and the failing case; still no fix
//
// Each hint is grounded in the problem's knowledge-graph context pack, the learner's
// last attempt on this problem (verdict, failing input, root cause) and their weak facets.
// The output is schema-constrained, ids are checked against the pack, and a spoiler guard
// strips anything that looks like a solution.
import { Type } from "@google/genai";
import { col } from "./db.js";
import { graph, buildContextPack, FACET_LABEL } from "./graph.js";
import { llmJson } from "./llm.js";
import { loadMastery, THRESHOLDS } from "./mastery.js";

export const HINT_LEVELS = {
  1: {
    name: "Nudge",
    brief:
      "Ask 1-2 short questions that make the learner look at the right part of the problem or their code. " +
      "Do NOT name any technique, data structure, algorithm or concept. Do NOT mention line numbers.",
  },
  2: {
    name: "Concept",
    brief:
      "Name the ONE concept or invariant from the knowledge pack that is at stake (focus_node), say in plain words what must stay true, " +
      "and ask the learner to check their code against it. You may describe the kind of mistake, but not where it is.",
  },
  3: {
    name: "Pinpoint",
    brief:
      "Point at the specific region of the learner's code (a variable, a condition, a loop boundary) and connect it to the failing case. " +
      "Ask what that piece does on that input. Still do NOT write the corrected code or state the fix.",
  },
};
export const MAX_LEVEL = 3;
export const clampLevel = (l) => Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(l)) || 1));

const MAX_CODE = 10000;
const clip = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n) + "\n…[truncated]" : s ?? "");

export const HINT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    focus_node: { type: Type.STRING, nullable: true },
    misconception: { type: Type.STRING, nullable: true },
    questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    observation: { type: Type.STRING },
    nudge: { type: Type.STRING },
  },
  required: ["questions", "nudge"],
};

// ---------- context ----------

/** Weak or shaky facets of the nodes this problem touches, weakest first. */
export function weakFacetsFor(pack, mastery, limit = 4) {
  const ids = [...pack.tested_nodes.map((n) => n.id), ...pack.prerequisite_nodes.map((n) => n.id)];
  const out = [];
  for (const id of ids) {
    for (const [facet, st] of Object.entries(mastery.get(id) ?? {})) {
      if (st.evidence < THRESHOLDS.minEvidence || st.status === "solid") continue;
      const traps = new Map();
      for (const e of st.log ?? []) if (e.polarity === "negative" && e.misconception) traps.set(e.misconception, (traps.get(e.misconception) ?? 0) + 1);
      out.push({
        node: id, name: graph.nodes.get(id)?.name ?? id, facet, facetLabel: FACET_LABEL[facet],
        mastery: st.mastery, status: st.status,
        misconceptions: [...traps].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m),
      });
    }
  }
  return out.sort((a, b) => a.mastery - b.mastery).slice(0, limit);
}

/** What the learner's most recent run/submit on this problem showed. */
export function describeLastAttempt(a) {
  if (!a) return null;
  const r = a.result ?? {};
  return {
    kind: a.kind,
    verdict: a.verdict,
    tests: r.totalTestcases ? `${r.totalCorrect ?? "?"}/${r.totalTestcases}` : null,
    failingInput: r.lastTestcase ? clip(String(r.lastTestcase), 500) : null,
    expected: r.expectedOutput ? clip(String(r.expectedOutput), 200) : null,
    got: r.codeOutput ? clip(String(r.codeOutput), 200) : null,
    error: clip(r.compileError || r.runtimeError || "", 600) || null,
    rootCause: a.analysis?.rootCause ?? null,
    rootCauseDesc: a.analysis?.rootCause ? graph.misconceptions.get(a.analysis.rootCause)?.desc ?? null : null,
    sameCode: null, // filled by the caller
  };
}

const normCode = (s) => String(s ?? "").replace(/\s+/g, "");

// ---------- prompt ----------

export function buildHintPrompt({ title, description, code, question, level, pack, last, weak, previous = [] }) {
  const L = HINT_LEVELS[level];
  const packText = pack
    ? JSON.stringify({
        approaches: pack.problem.approaches,
        tested_nodes: pack.tested_nodes.map((n) => ({ id: n.id, name: n.name, role: n.role, misconceptions: n.misconceptions.map(({ id, desc, likely }) => ({ id, desc, ...(likely ? { likely } : {}) })) })),
        prerequisite_nodes: pack.prerequisite_nodes.map((n) => ({ id: n.id, name: n.name, misconceptions: n.misconceptions.map(({ id, desc }) => ({ id, desc })) })),
      })
    : "(this problem is not mapped to the knowledge graph; reason from the statement and code)";

  const lastText = last
    ? [
        `Most recent ${last.kind.toUpperCase()}: ${last.verdict}${last.tests ? ` (${last.tests} tests)` : ""}${last.sameCode ? " — the code below is unchanged since then" : " — the code may have changed since then"}`,
        last.failingInput && `Failing input: ${last.failingInput}`,
        last.expected && `Expected: ${last.expected}`,
        last.got && `Their output: ${last.got}`,
        last.error && `Error: ${last.error}`,
        last.rootCause && `Grader's diagnosis (do NOT reveal verbatim): ${last.rootCause} — ${last.rootCauseDesc}`,
      ].filter(Boolean).join("\n")
    : "No run or submit captured yet for this problem.";

  const weakText = weak?.length
    ? weak.map((w) => `- ${w.name} · ${w.facetLabel}: ${w.status} (${Math.round(w.mastery * 100)}%)${w.misconceptions.length ? `; past traps: ${w.misconceptions.join(", ")}` : ""}`).join("\n")
    : "- nothing known yet";

  const prevText = previous.length
    ? previous.map((p) => `- level ${p.level}: ${p.text}`).join("\n")
    : "- none";

  return `You are AlgoSensei, a Socratic DSA mentor for C++ learners on LeetCode. You never give solutions.

PROBLEM: ${title}
${clip(description, 3000)}

KNOWLEDGE PACK (concepts this problem tests, their prerequisites, and known misconceptions):
${packText}

WHAT THE LEARNER'S LAST ATTEMPT SHOWED:
${lastText}

LEARNER'S WEAK OR SHAKY FACETS AMONG THESE CONCEPTS:
${weakText}

HINTS ALREADY GIVEN ON THIS PROBLEM (do not repeat them; go one step further):
${prevText}

LEARNER'S CODE:
\`\`\`
${clip(code, MAX_CODE)}
\`\`\`

LEARNER'S QUESTION: ${clip(question || "I'm stuck. Give me a hint.", 500)}

HINT LEVEL ${level} of ${MAX_LEVEL} — ${L.name.toUpperCase()}:
${L.brief}

RULES:
- If the code is empty or barely started, hint toward modeling the problem and choosing an approach, not toward bugs.
- If the last verdict was Time Limit Exceeded, focus on the cost of the approach versus the constraints.
- Prefer the deepest cause: an off-by-one is about loop bounds, not the pattern.
- Never output corrected code, pseudo-code of the solution, or the final answer. At most one short code fragment quoting the learner's own code.
- focus_node: the node id from the pack your hint is about (null at level 1 is fine). misconception: the pack misconception id you suspect, or null. Use only ids from the pack.
- questions: 1-2 questions. observation: one sentence of what to look at (empty at level 1 if it would name a concept). nudge: one encouraging sentence that points the direction.
Address the learner as "you". Keep the whole hint under 90 words.`;
}

// ---------- output hygiene ----------

const SOLUTION_SHAPES = [
  /\bclass\s+Solution\b/,
  /\b(?:int|long long|bool|void|vector<[^>]+>|string|double)\s+\w+\s*\([^)]*\)\s*\{/, // a function definition
  /\breturn\b[^;\n]*;[\s\S]*\breturn\b/, // more than one return: likely a full body
];

/** Removes solution-sized code. Keeps short quotes of the learner's own code. */
export function guardSpoilers(text) {
  let s = String(text ?? "");
  let stripped = false;
  s = s.replace(/```[\s\S]*?```/g, (block) => {
    const lines = block.split("\n").length - 2;
    if (lines > 3 || SOLUTION_SHAPES.some((re) => re.test(block))) {
      stripped = true;
      return "[code removed: AlgoSensei doesn't hand out solutions]";
    }
    return block;
  });
  if (SOLUTION_SHAPES.slice(0, 2).some((re) => re.test(s))) {
    stripped = true;
    s = s.replace(/[^\n]*\{[\s\S]*\}[^\n]*/g, "[code removed: AlgoSensei doesn't hand out solutions]");
  }
  return { text: s.trim(), stripped };
}

export function sanitizeHint(raw, { level, pack }) {
  const allowedNodes = new Set(pack ? [...pack.tested_nodes.map((n) => n.id), ...pack.prerequisite_nodes.map((n) => n.id)] : []);
  let focusNode = raw?.focus_node && allowedNodes.has(raw.focus_node) ? raw.focus_node : null;
  let misconception = raw?.misconception && graph.misconceptions.has(raw.misconception) ? raw.misconception : null;
  if (misconception && !allowedNodes.has(graph.misconceptions.get(misconception).node)) misconception = null;
  if (misconception && !focusNode) focusNode = graph.misconceptions.get(misconception).node;

  let stripped = false;
  const clean = (t, n) => {
    const g = guardSpoilers(String(t ?? "").slice(0, n));
    stripped ||= g.stripped;
    return g.text;
  };
  const questions = (Array.isArray(raw?.questions) ? raw.questions : []).map((q) => clean(q, 300)).filter(Boolean).slice(0, 2);
  const observation = clean(raw?.observation, 300);
  const nudge = clean(raw?.nudge, 300);

  // Level 1 must not name the concept: keep the ids for bookkeeping, but don't surface them.
  const reveal = level >= 2;
  const parts = [];
  if (questions.length) parts.push(`🤔 Think about this\n${questions.map((q) => `• ${q}`).join("\n")}`);
  if (observation) parts.push(`🔍 Look closer\n${observation}`);
  if (nudge) parts.push(`🧭 ${nudge}`);
  const text = parts.join("\n\n") || "Try tracing your code by hand on the smallest input that could break it. What do you expect at each step, and what actually happens?";

  return {
    level,
    levelName: HINT_LEVELS[level].name,
    focusNode: reveal ? focusNode : null,
    focusName: reveal && focusNode ? graph.nodes.get(focusNode)?.name ?? null : null,
    misconception, // stored, never shown verbatim
    questions, observation, nudge,
    text,
    stripped,
    nextLevel: level < MAX_LEVEL ? level + 1 : null,
    _focusNode: focusNode,
  };
}

// ---------- orchestration ----------

/**
 * Builds and returns one hint. `resolveProblem` is injected to avoid a cycle with pipeline.js.
 * userId may be null (legacy callers without a device token): then no history is used.
 */
export async function generateHint({ userId, slug, title, description, code, question, level, apiKey, resolveProblem }) {
  level = clampLevel(level);
  const { problem } = slug ? await resolveProblem({ slug, title, description, apiKey }) : { problem: null };
  const pack = problem ? buildContextPack(graph, problem) : null;

  let last = null;
  let weak = [];
  let previous = [];
  if (userId && slug) {
    const [lastAttempt, mastery, prevHints] = await Promise.all([
      col.attempts.findOne({ userId, slug }, { sort: { createdAt: -1 }, projection: { kind: 1, verdict: 1, result: 1, analysis: 1, code: 1 } }),
      pack ? loadMastery(userId) : Promise.resolve(new Map()),
      col.events.find({ userId, slug, type: "hint", text: { $exists: true } }).sort({ createdAt: -1 }).limit(3).toArray(),
    ]);
    last = describeLastAttempt(lastAttempt);
    if (last) last.sameCode = Boolean(code) && normCode(code) === normCode(lastAttempt.code);
    if (pack) weak = weakFacetsFor(pack, mastery);
    previous = prevHints.reverse().map((h) => ({ level: h.level ?? 1, text: String(h.text).slice(0, 300) }));
  }

  const prompt = buildHintPrompt({ title, description, code, question, level, pack, last, weak, previous });
  const raw = await llmJson({ apiKey, prompt, schema: HINT_SCHEMA });
  const hint = sanitizeHint(raw, { level, pack });
  return { ...hint, problemId: problem?.id ?? null, grounded: Boolean(pack), usedLastAttempt: Boolean(last) };
}
