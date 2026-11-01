// "Highest-output next move": a deterministic ranking over four kinds of action.
//   fix      — the deepest weak (node, facet) whose prerequisites are not weak themselves
//   revise   — FSRS cards that are due
//   finish   — problems attempted but not yet accepted
//   advance  — the next sheet problem whose concepts are within reach
import { col } from "./db.js";
import { graph, sheetProblems, problemsForNode, FACET_LABEL, problemBySlug, ancestors } from "./graph.js";
import { loadMastery, THRESHOLDS } from "./mastery.js";
import { dueCards, retrievability } from "./reviews.js";

const isWeak = (f) => f && f.evidence >= THRESHOLDS.minEvidence && f.mastery < 0.5;

function topMisconceptions(log = []) {
  const counts = new Map();
  for (const e of log) if (e.polarity === "negative" && e.misconception) counts.set(e.misconception, (counts.get(e.misconception) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count, desc: graph.misconceptions.get(id)?.desc ?? id }));
}

const negAttempts = (st) => new Set((st?.log ?? []).filter((e) => e.polarity === "negative" && e.attemptId).map((e) => String(e.attemptId)));

// The real gap may live in a prerequisite. A weak ancestor absorbs this gap only when there is
// causal evidence: both were flagged in the same attempt. Among those, the deepest wins.
function rootGap(mastery, nodeId, facet) {
  const mine = negAttempts(mastery.get(nodeId)?.[facet]);
  let best = null;
  for (const [a] of ancestors(graph, nodeId)) {
    for (const [f, st] of Object.entries(mastery.get(a) ?? {})) {
      if (!isWeak(st)) continue;
      if (![...negAttempts(st)].some((id) => mine.has(id))) continue;
      const layer = graph.nodes.get(a).layer;
      if (!best || layer < best.layer || (layer === best.layer && st.mastery < best.mastery)) best = { node: a, facet: f, layer, mastery: st.mastery };
    }
  }
  return best ? { node: best.node, facet: best.facet } : { node: nodeId, facet };
}

export async function nextMoves(userId, { now = new Date(), limit = 7 } = {}) {
  const mastery = await loadMastery(userId);
  const progressRows = await col.progress.find({ userId }).toArray();
  const progress = new Map(progressRows.map((p) => [p.slug, p]));
  const solvedIds = new Set(progressRows.filter((p) => p.solved && p.problemId).map((p) => p.problemId));
  const attemptedIds = new Set(progressRows.filter((p) => p.problemId && (p.runs || p.submits)).map((p) => p.problemId));
  const moves = [];

  // ---- fix: weakest gaps, resolved to their root ----
  const gaps = new Map();
  for (const [node, facets] of mastery) {
    for (const [facet, f] of Object.entries(facets)) {
      if (!isWeak(f)) continue;
      const root = rootGap(mastery, node, facet);
      const key = `${root.node}|${root.facet}`;
      const rf = mastery.get(root.node)?.[root.facet] ?? f;
      const layer = graph.nodes.get(root.node).layer;
      const recentNeg = (rf.log ?? []).filter((e) => e.polarity === "negative" && now - new Date(e.at) < 7 * 864e5).length;
      const score = 0.55 + 0.3 * (1 - rf.mastery) * Math.min(1, rf.evidence / 2) + 0.03 * (4 - layer) + 0.02 * Math.min(recentNeg, 3);
      const prev = gaps.get(key);
      const via = root.node !== node ? [...(prev?.via ?? []), `${node}·${facet}`] : prev?.via ?? [];
      if (!prev || prev.score < score) gaps.set(key, { ...root, state: rf, score, via });
      else prev.via = via;
    }
  }
  for (const g of [...gaps.values()].sort((a, b) => b.score - a.score).slice(0, 3)) {
    const n = graph.nodes.get(g.node);
    const traps = topMisconceptions(g.state.log);
    const practice = problemsForNode(g.node)
      .map(({ problem, role }) => ({ id: problem.id, title: problem.title, role, slug: problem.links?.leetcode ?? null, solved: solvedIds.has(problem.id) }))
      .sort((a, b) => Number(a.solved) - Number(b.solved))
      .slice(0, 3);
    moves.push({
      type: "fix",
      score: g.score,
      title: `Fix the missing link: ${n.name} — ${FACET_LABEL[g.facet]}`,
      reason: traps.length
        ? `Your attempts keep showing: ${traps.map((t) => `${t.desc}${t.count > 1 ? ` (${t.count}×)` : ""}`).join(" · ")}`
        : `Mastery ${Math.round(g.state.mastery * 100)}% on ${FACET_LABEL[g.facet].toLowerCase()} for this concept.`,
      detail: {
        node: g.node, facet: g.facet, nodeName: n.name, layer: n.layer, criterion: n.facets[g.facet],
        mastery: g.state.mastery, evidence: g.state.evidence, misconceptions: traps,
        surfacedVia: g.via.slice(0, 4), practice,
        steps: ["Do the drill to isolate this facet", practice[0] ? `Solve "${practice[0].title}" where it is ${practice[0].role}` : "Solve a problem that uses it", "It moves to revision once it reads solid"],
      },
    });
  }

  // ---- revise: due cards ----
  const due = await dueCards(userId, { now, limit: 200 });
  if (due.length) {
    const minR = Math.min(...due.map((c) => retrievability(c, now) ?? 1));
    moves.push({
      type: "revise",
      score: 0.5 + 0.04 * Math.min(due.length, 6) + 0.25 * (1 - minR),
      title: `Revise ${due.length} card${due.length > 1 ? "s" : ""} before they fade`,
      reason: `Lowest predicted recall right now: ${Math.round(minR * 100)}%.`,
      detail: { count: due.length, minRetrievability: minR, nodes: [...new Set(due.map((c) => graph.nodes.get(c.node)?.name))].slice(0, 5) },
    });
  }

  // ---- finish: attempted, not accepted ----
  const unfinished = progressRows
    .filter((p) => !p.solved && (p.submits || p.runs) && now - new Date(p.lastAttemptAt ?? p.updatedAt) < 21 * 864e5)
    .sort((a, b) => new Date(b.lastAttemptAt) - new Date(a.lastAttemptAt))
    .slice(0, 2);
  for (const p of unfinished) {
    moves.push({
      type: "finish",
      score: 0.48 - 0.02 * Math.min(p.wrongSubmits ?? 0, 5),
      title: `Finish "${p.title ?? p.slug}"`,
      reason: `${p.runs ?? 0} runs, ${p.submits ?? 0} submits so far${p.lastVerdict ? ` — last verdict: ${p.lastVerdict}` : ""}.`,
      detail: { slug: p.slug, problemId: p.problemId ?? null, lastVerdict: p.lastVerdict ?? null },
    });
  }

  // ---- advance: next sheet problem whose concepts are within reach ----
  const weakNodes = new Set([...gaps.values()].map((g) => g.node));
  const reachable = (p) =>
    !solvedIds.has(p.id) && !attemptedIds.has(p.id) &&
    !p.nodes.some((t) => t.role === "core" && (graph.nodes.get(t.id)?.prereqs ?? []).some((q) => weakNodes.has(q)));
  // Prefer problems the extension can track (LeetCode-linked), then the rest of the sheet.
  const next = sheetProblems.find((p) => p.links?.leetcode && reachable(p)) ?? sheetProblems.find(reachable);
  if (next) {
    const core = next.nodes.filter((t) => t.role === "core").map((t) => graph.nodes.get(t.id).name);
    moves.push({
      type: "advance",
      score: gaps.size ? 0.4 : 0.62,
      title: `Next problem: ${next.title}`,
      reason: `Introduces ${core.join(", ")}. Its prerequisites look solid enough.`,
      detail: { problemId: next.id, slug: next.links?.leetcode ?? null, tier: next.tier, section: next.section, order: next.order, topic: next.topic, topicTitle: next.topicTitle, core },
    });
  }

  moves.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const type of ["fix", "revise", "finish", "advance"]) {
    const first = moves.find((m) => m.type === type);
    if (first) picked.push(first);
  }
  for (const m of moves) if (picked.length < limit && !picked.includes(m)) picked.push(m);
  return picked.sort((a, b) => b.score - a.score).map((m) => ({ ...m, score: Math.round(m.score * 100) / 100 }));
}

export { problemBySlug };
