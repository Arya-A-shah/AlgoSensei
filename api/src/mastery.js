// Student model: one Beta(alpha, beta) per (user, node, facet).
//   mastery   = alpha / (alpha + beta)
//   evidence  = alpha + beta - 1   (how much we have seen; prior is Beta(0.5, 0.5))
// Evidence comes from LLM findings and from deterministic verdict signals.
import { col } from "./db.js";
import { graph, nodeFacetExists } from "./graph.js";

export const PRIOR = { alpha: 0.5, beta: 0.5 };
const LOG_LIMIT = 25;

export const THRESHOLDS = {
  minEvidence: 0.5, // below this a facet is "unknown"
  weak: 0.45,
  solid: 0.7,
};

export function facetState({ alpha, beta }) {
  const mastery = alpha / (alpha + beta);
  const evidence = alpha + beta - (PRIOR.alpha + PRIOR.beta);
  let status = "unknown";
  if (evidence >= THRESHOLDS.minEvidence) {
    status = mastery < THRESHOLDS.weak ? "weak" : mastery < THRESHOLDS.solid ? "shaky" : "solid";
  }
  return { mastery: Math.round(mastery * 1000) / 1000, evidence: Math.round(evidence * 100) / 100, status };
}

const ROLE_WEIGHT = { core: 1.0, supporting: 0.6 };
const RELATED_WEIGHT = 0.8; // prerequisite pinpointed by the grader: specific, so fairly strong
const POSITIVE_SCALE = 0.6; // praise is cheaper than a pinpointed mistake

// How much a hint ladder level gave away. A nudge leaves most of the thinking to the
// learner; a pinpoint does a good part of the debugging for them.
export const HINT_FACTOR = { 1: 0.9, 2: 0.75, 3: 0.6 };
const LEGACY_HINT_FACTOR = 0.7; // hints recorded before the ladder existed

// How cleanly the problem was solved, 0.35..1
export function cleanliness(progress) {
  const wrong = progress?.wrongSubmits ?? 0;
  const hints = progress?.hints ?? 0;
  let c = wrong === 0 ? 1 : wrong <= 2 ? 0.7 : 0.5;
  if (hints > 0) c *= HINT_FACTOR[progress?.maxHintLevel] ?? LEGACY_HINT_FACTOR;
  return Math.max(0.35, c);
}

/**
 * Turns one attempt (+ its analysis) into evidence items:
 *   { node, facet, polarity, weight, source, misconception?, note }
 */
export function deriveEvidence({ attempt, problem, analysis, progress }) {
  const items = [];
  const roleOf = new Map((problem?.nodes ?? []).map((t) => [t.id, t.role]));
  const covered = new Set();

  // 1) LLM findings
  for (const f of analysis?.findings ?? []) {
    const role = roleOf.get(f.node);
    const base = role ? ROLE_WEIGHT[role] : RELATED_WEIGHT;
    let w = base * f.confidence;
    if (f.polarity === "positive") w *= POSITIVE_SCALE;
    // A passing RUN only exercised sample tests: discount its praise.
    if (attempt.kind === "run" && f.polarity === "positive") w *= 0.5;
    items.push({ node: f.node, facet: f.facet, polarity: f.polarity, weight: w, source: "llm", misconception: f.misconception, note: f.evidence });
    covered.add(`${f.node}|${f.facet}|${f.polarity}`);
  }

  if (attempt.kind !== "submit" || !problem) return items;

  // 2) Deterministic signals from the verdict (submits only)
  if (attempt.verdict === "Accepted") {
    const c = cleanliness(progress);
    // Credit the nodes of the approach actually written, if the grader identified it.
    let credited = (problem.nodes ?? []).filter((t) => t.role === "core").map((t) => t.id);
    let scale = analysis ? 0.6 : 0.3;
    const match = analysis?.approachName
      ? (problem.approaches ?? []).find((a) => a.name.toLowerCase() === analysis.approachName.toLowerCase())
      : null;
    const level = match?.level ?? analysis?.approachLevel;
    if (match?.demonstrates?.length) credited = match.demonstrates;
    if (level === "brute") scale *= 0.5;

    for (const node of credited) {
      if (!nodeFacetExists(node, "implement")) continue;
      if (covered.has(`${node}|implement|negative`)) continue;
      items.push({ node, facet: "implement", polarity: "positive", weight: scale * c, source: "verdict", note: `Accepted (${level ?? "approach unknown"})` });
      // Upward inference: a clean solve is light evidence the direct prerequisites hold.
      for (const p of graph.nodes.get(node)?.prereqs ?? []) {
        if (nodeFacetExists(p, "implement")) {
          items.push({ node: p, facet: "implement", polarity: "positive", weight: 0.15 * c, source: "inferred", note: `prerequisite of ${node}` });
        }
      }
    }
  } else if (attempt.verdict === "Time Limit Exceeded" && !covered.has("r.complexity_analysis|recognize|negative")) {
    items.push({ node: "r.complexity_analysis", facet: "recognize", polarity: "negative", weight: 0.5, source: "verdict", misconception: "r.cx.constraint_blind", note: "Time Limit Exceeded" });
  }

  return items;
}

/** Applies evidence items; returns the before/after state of every touched facet. */
export async function applyEvidence(userId, items, { attemptId = null, at = new Date() } = {}) {
  const changes = [];
  for (const it of items) {
    if (!nodeFacetExists(it.node, it.facet) || !(it.weight > 0)) continue;
    const key = { userId, node: it.node, facet: it.facet };
    const before = (await col.mastery.findOne(key)) ?? { ...PRIOR };
    const inc = it.polarity === "positive" ? { alpha: it.weight, beta: 0 } : { alpha: 0, beta: it.weight };
    const logEntry = {
      at, attemptId, polarity: it.polarity, weight: Math.round(it.weight * 1000) / 1000,
      source: it.source, misconception: it.misconception ?? null, note: it.note ?? null,
    };
    if (!before._id) {
      try {
        await col.mastery.insertOne({
          ...key, alpha: PRIOR.alpha + inc.alpha, beta: PRIOR.beta + inc.beta,
          createdAt: at, updatedAt: at, log: [logEntry],
        });
      } catch (e) {
        if (e.code !== 11000) throw e; // inserted concurrently: fall through to update
        await col.mastery.updateOne(key, { $inc: inc, $set: { updatedAt: at }, $push: { log: { $each: [logEntry], $slice: -LOG_LIMIT } } });
      }
    } else {
      await col.mastery.updateOne(key, {
        $inc: inc,
        $set: { updatedAt: at },
        $push: { log: { $each: [logEntry], $slice: -LOG_LIMIT } },
      });
    }
    const final = await col.mastery.findOne(key);
    changes.push({ node: it.node, facet: it.facet, polarity: it.polarity, before: facetState(before), after: facetState(final) });
  }
  return changes;
}

/** Full state map for a user: node -> facet -> {mastery, evidence, status, log} */
export async function loadMastery(userId) {
  const rows = await col.mastery.find({ userId }).toArray();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.node)) map.set(r.node, {});
    map.get(r.node)[r.facet] = { ...facetState(r), log: r.log ?? [] };
  }
  return map;
}

export function nodeSummary(facets = {}) {
  const vals = Object.values(facets).filter((f) => f.evidence >= THRESHOLDS.minEvidence);
  if (!vals.length) return { mastery: null, status: "unknown", evidence: 0 };
  const totalEv = vals.reduce((s, f) => s + f.evidence, 0);
  const mastery = vals.reduce((s, f) => s + f.mastery * f.evidence, 0) / totalEv;
  const status = vals.some((f) => f.status === "weak") ? "weak" : mastery < THRESHOLDS.solid ? "shaky" : "solid";
  return { mastery: Math.round(mastery * 1000) / 1000, status, evidence: Math.round(totalEv * 100) / 100 };
}
