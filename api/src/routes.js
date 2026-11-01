import { Hono } from "hono";
import { ObjectId } from "mongodb";
import { col } from "./db.js";
import { config } from "./config.js";
import { graph, sheetProblems, topicList, FACET_LABEL, FACET_BLOOM } from "./graph.js";
import { registerUser, requireUser } from "./auth.js";
import { ingestEvent, processAttempt, resolveProblem } from "./pipeline.js";
import { loadMastery, nodeSummary } from "./mastery.js";
import { dueCards, upcomingCards, gradeCard, ensurePrompt, pickVariant, retrievability, Rating, State } from "./reviews.js";
import { nextMoves } from "./recommend.js";
import { generateHint, clampLevel } from "./hints.js";

export const api = new Hono();

const LAYER_TITLES = Object.fromEntries(graph.layers.map(({ data }) => [data.layer, data.title]));
const SECTION_TITLES = new Map(topicList.flatMap((t) => t.sections.map((s) => [`${t.topic}|${s.id}`, s.title])));
const TOPICS = topicList.map(({ topic, title, step, sections }) => ({ topic, title, step, sections }));
const nodeName = (id) => graph.nodes.get(id)?.name ?? id;
const promptKey = (c) => c.req.header("X-Gemini-Key") || config.geminiKey || "";
const oid = (s) => { try { return new ObjectId(s); } catch { return null; } };

api.post("/register", async (c) => c.json(await registerUser()));

api.use("/events", requireUser);
api.use("/hints", requireUser);
api.use("/me/*", requireUser);

api.post("/events", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid JSON" }, 400);
  try {
    return c.json(await ingestEvent(user._id, body, { userKey: c.req.header("X-Gemini-Key") || "" }));
  } catch (e) {
    return c.json({ error: e.message }, 400);
  }
});

// ---------- hint ladder (used by the extension) ----------
// Body: { slug, title, description, code, question, level: 1..3 }
api.post("/hints", async (c) => {
  const user = c.get("user");
  const apiKey = promptKey(c);
  if (!apiKey) return c.json({ error: "No Gemini key: save one in the extension popup, or set GEMINI_API_KEY on the server." }, 400);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid JSON" }, 400);
  const res = await hintResponse(user._id, body, apiKey);
  return c.json(res.body, res.status);
});

/** Shared by /api/hints and the legacy /hint route. userId may be null. */
export async function hintResponse(userId, body, apiKey) {
  const slug = typeof body.slug === "string" && /^[a-z0-9-]+$/.test(body.slug) ? body.slug : null;
  const level = clampLevel(body.level ?? 1);
  try {
    const hint = await generateHint({
      userId, slug, level, apiKey, resolveProblem,
      title: String(body.title ?? slug ?? "").slice(0, 200),
      description: String(body.description ?? "").slice(0, 6000),
      code: String(body.code ?? "").slice(0, 50000),
      question: String(body.question ?? body.prompt ?? "").slice(0, 500),
    });
    if (userId && slug) {
      await ingestEvent(userId, {
        type: "hint", slug, title: body.title, prompt: body.question ?? body.prompt,
        level, focusNode: hint._focusNode, misconception: hint.misconception, text: hint.text,
      }).catch((e) => console.error("hint event", e.message));
    }
    const { _focusNode, misconception, ...shown } = hint;
    return { status: 200, body: { hint: hint.text, ...shown } };
  } catch (e) {
    console.error("hint failed", e.message);
    return { status: 502, body: { error: `Hint generation failed: ${e.message}` } };
  }
}

// ---------- overview: the knowledge mirror ----------
api.get("/me/overview", async (c) => {
  const user = c.get("user");
  const now = new Date();
  const [mastery, progressRows, attemptsAgg, cardsTotal, cardsDue, recent] = await Promise.all([
    loadMastery(user._id),
    col.progress.find({ userId: user._id }).toArray(),
    col.attempts.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: { kind: "$kind", verdict: "$verdict" }, n: { $sum: 1 } } },
    ]).toArray(),
    col.cards.countDocuments({ userId: user._id }),
    col.cards.countDocuments({ userId: user._id, due: { $lte: now } }),
    col.attempts.find({ userId: user._id }, { projection: { code: 0, result: 0 } }).sort({ createdAt: -1 }).limit(400).toArray(),
  ]);

  const layers = [...new Set([...graph.nodes.values()].map((n) => n.layer))].sort().map((layer) => ({
    layer,
    title: LAYER_TITLES[layer],
    nodes: [...graph.nodes.values()].filter((n) => n.layer === layer).map((n) => {
      const m = mastery.get(n.id) ?? {};
      const seen = new Map();
      for (const f of Object.values(m)) for (const e of f.log) {
        if (e.polarity === "negative" && e.misconception) seen.set(e.misconception, (seen.get(e.misconception) ?? 0) + 1);
      }
      return {
        id: n.id, name: n.name, description: n.description, prereqs: n.prereqs, topic: n.topic ?? null,
        summary: nodeSummary(m),
        facets: Object.fromEntries(Object.keys(n.facets).map((f) => [f, {
          criterion: n.facets[f],
          ...(m[f] ? { mastery: m[f].mastery, evidence: m[f].evidence, status: m[f].status } : { mastery: null, evidence: 0, status: "unknown" }),
        }])),
        misconceptionsSeen: [...seen].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count, desc: graph.misconceptions.get(id)?.desc })),
      };
    }),
  }));

  const bySlug = new Map(progressRows.map((p) => [p.slug, p]));
  const byProblemId = new Map(progressRows.filter((p) => p.problemId).map((p) => [p.problemId, p]));
  const sheet = sheetProblems.map((p) => {
    const pr = byProblemId.get(p.id) ?? (p.links?.leetcode ? bySlug.get(p.links.leetcode) : null);
    return {
      id: p.id, title: p.title, order: p.order, section: p.section, tier: p.tier, slug: p.links?.leetcode ?? null,
      topic: p.topic, step: p.step, sectionTitle: SECTION_TITLES.get(`${p.topic}|${p.section}`) ?? p.section,
      status: pr?.solved ? "solved" : pr && (pr.runs || pr.submits) ? "attempted" : "new",
      firstTry: pr?.firstTryAccepted ?? null,
      core: p.nodes.filter((t) => t.role === "core").map((t) => nodeName(t.id)),
      nodes: p.nodes.map((t) => ({ id: t.id, role: t.role })),
    };
  });

  const count = (kind, verdict) => attemptsAgg.filter((a) => (!kind || a._id.kind === kind) && (!verdict || a._id.verdict === verdict)).reduce((s, a) => s + a.n, 0);
  const days = new Map();
  for (const a of recent) {
    const d = a.createdAt.toISOString().slice(0, 10);
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now - i * 864e5).toISOString().slice(0, 10);
    if (days.has(d)) streak++;
    else if (i > 0) break;
  }

  const recentChanges = recent
    .filter((a) => a.masteryChanges?.length)
    .slice(0, 8)
    .map((a) => ({ attemptId: a._id, title: a.title, verdict: a.verdict, kind: a.kind, at: a.createdAt, changes: a.masteryChanges.map((m) => ({ ...m, nodeName: nodeName(m.node) })) }));

  return c.json({
    user: { id: user._id, createdAt: user.createdAt },
    stats: {
      runs: count("run"), submits: count("submit"), accepted: count("submit", "Accepted"),
      solved: progressRows.filter((p) => p.solved).length, problemsTouched: progressRows.length,
      cardsTotal, cardsDue, streakDays: streak,
    },
    activity: [...days].sort().map(([day, n]) => ({ day, n })),
    layers, sheet, topics: TOPICS, recentChanges,
  });
});

// ---------- history ----------
api.get("/me/attempts", async (c) => {
  const user = c.get("user");
  const q = { userId: user._id };
  const slug = c.req.query("slug");
  if (slug) q.slug = slug;
  const kind = c.req.query("kind");
  if (kind === "run" || kind === "submit") q.kind = kind;
  const before = c.req.query("before");
  if (before) q.createdAt = { $lt: new Date(before) };
  const limit = Math.min(100, Number(c.req.query("limit") ?? 40));
  const rows = await col.attempts
    .find(q, { projection: { code: 0, "result.stdout": 0, "analysis.dropped": 0 } })
    .sort({ createdAt: -1 }).limit(limit).toArray();
  return c.json({
    attempts: rows.map((a) => ({
      id: a._id, slug: a.slug, title: a.title, kind: a.kind, verdict: a.verdict, lang: a.lang, createdAt: a.createdAt,
      problemId: a.problemId, tests: a.result?.totalTestcases ? `${a.result.totalCorrect}/${a.result.totalTestcases}` : null,
      runtime: a.result?.runtime ?? null, msSinceOpen: a.msSinceOpen,
      hintsBefore: a.progressBefore?.hints ?? 0, hintLevel: a.progressBefore?.maxHintLevel ?? null,
      analysis: {
        status: a.analysis?.status, approachLevel: a.analysis?.approachLevel, summary: a.analysis?.summary,
        rootCause: a.analysis?.rootCause ? { id: a.analysis.rootCause, desc: graph.misconceptions.get(a.analysis.rootCause)?.desc } : null,
        negatives: (a.analysis?.findings ?? []).filter((f) => f.polarity === "negative").length,
        positives: (a.analysis?.findings ?? []).filter((f) => f.polarity === "positive").length,
      },
      masteryChanges: (a.masteryChanges ?? []).map((m) => ({ ...m, nodeName: nodeName(m.node) })),
    })),
  });
});

api.get("/me/attempts/:id", async (c) => {
  const user = c.get("user");
  const a = await col.attempts.findOne({ _id: oid(c.req.param("id")), userId: user._id });
  if (!a) return c.json({ error: "not found" }, 404);
  const findings = (a.analysis?.findings ?? []).map((f) => ({
    ...f, nodeName: nodeName(f.node), facetLabel: FACET_LABEL[f.facet],
    misconceptionDesc: f.misconception ? graph.misconceptions.get(f.misconception)?.desc : null,
  }));
  const problem = a.problemId ? graph.problems.get(a.problemId) ?? (await col.problemTags.findOne({ slug: a.slug }))?.problem : null;
  // Hints asked on this problem since the previous attempt (what led to this code).
  const prev = await col.attempts.findOne({ userId: user._id, slug: a.slug, createdAt: { $lt: a.createdAt } }, { sort: { createdAt: -1 }, projection: { createdAt: 1 } });
  const hintRows = await col.events
    .find({ userId: user._id, slug: a.slug, type: "hint", createdAt: { $lte: a.createdAt, ...(prev ? { $gt: prev.createdAt } : {}) } })
    .sort({ createdAt: 1 }).limit(10).toArray();
  const hints = hintRows.map((h) => ({ level: h.level ?? null, at: h.createdAt, text: h.text ?? null, question: h.prompt || null, focusNode: h.level >= 2 ? h.focusNode ?? null : null, focusName: h.level >= 2 && h.focusNode ? nodeName(h.focusNode) : null }));
  return c.json({
    hints,
    attempt: {
      ...a, id: a._id,
      analysis: { ...a.analysis, findings, rootCauseDesc: a.analysis?.rootCause ? graph.misconceptions.get(a.analysis.rootCause)?.desc : null },
      masteryChanges: (a.masteryChanges ?? []).map((m) => ({ ...m, nodeName: nodeName(m.node), facetLabel: FACET_LABEL[m.facet] })),
    },
    problem: problem ? { id: problem.id, title: problem.title, tier: problem.tier, autoTagged: !!problem.autoTagged, nodes: problem.nodes.map((t) => ({ ...t, name: nodeName(t.id) })) } : null,
  });
});

api.post("/me/attempts/:id/reanalyze", async (c) => {
  const user = c.get("user");
  const a = await col.attempts.findOne({ _id: oid(c.req.param("id")), userId: user._id });
  if (!a) return c.json({ error: "not found" }, 404);
  const apiKey = promptKey(c);
  if (!apiKey) return c.json({ error: "No Gemini key: add one in Settings or set GEMINI_API_KEY on the server." }, 400);
  const { problem } = await resolveProblem({ slug: a.slug, title: a.title, apiKey });
  if (!problem) return c.json({ error: "Problem could not be mapped to the knowledge graph" }, 400);
  a.analysis = { status: "pending" };
  a.problemId = problem.id;
  await col.attempts.updateOne({ _id: a._id }, { $set: { analysis: a.analysis, problemId: problem.id } });
  await processAttempt(a, problem, apiKey);
  return c.json({ ok: true });
});

// ---------- revision ----------
async function cardView(card, now, apiKey) {
  const n = graph.nodes.get(card.node);
  const prompt = pickVariant(await ensurePrompt(card.node, card.facet, "review", apiKey), card.reps ?? 0);
  const r = retrievability(card, now);
  return {
    id: card._id, node: card.node, nodeName: n?.name, facet: card.facet, facetLabel: FACET_LABEL[card.facet],
    bloom: FACET_BLOOM[card.facet], due: card.due, state: State[card.state], reps: card.reps, lapses: card.lapses,
    stability: Math.round(card.stability * 10) / 10, retrievability: r === null ? null : Math.round(r * 1000) / 1000,
    prompt,
  };
}

api.get("/me/reviews", async (c) => {
  const user = c.get("user");
  const now = new Date();
  const apiKey = promptKey(c);
  const [due, upcoming, total, reviewedToday] = await Promise.all([
    dueCards(user._id, { now, limit: 30 }),
    upcomingCards(user._id, { now, limit: 15 }),
    col.cards.countDocuments({ userId: user._id }),
    col.reviewLogs.countDocuments({ userId: user._id, source: "manual", reviewedAt: { $gte: new Date(now.toISOString().slice(0, 10)) } }),
  ]);
  return c.json({
    due: await Promise.all(due.map((cd) => cardView(cd, now, apiKey))),
    upcoming: upcoming.map((cd) => ({ id: cd._id, node: cd.node, nodeName: nodeName(cd.node), facet: cd.facet, facetLabel: FACET_LABEL[cd.facet], due: cd.due, stability: Math.round(cd.stability * 10) / 10 })),
    stats: { total, due: due.length, reviewedToday },
  });
});

api.post("/me/reviews/:id", async (c) => {
  const user = c.get("user");
  const { rating, answer } = await c.req.json().catch(() => ({}));
  if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(rating)) return c.json({ error: "rating must be 1-4" }, 400);
  const card = await gradeCard(user._id, oid(c.req.param("id")), rating, { answer: answer ? String(answer).slice(0, 4000) : null });
  if (!card) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true, due: card.due, stability: card.stability, state: State[card.state] });
});

// ---------- next best move ----------
api.get("/me/next", async (c) => {
  const user = c.get("user");
  const apiKey = promptKey(c);
  const moves = await nextMoves(user._id);
  for (const m of moves) {
    if (m.type === "fix") m.detail.drill = pickVariant(await ensurePrompt(m.detail.node, m.detail.facet, "drill", apiKey), 0);
  }
  return c.json({ moves, generatedAt: new Date() });
});
