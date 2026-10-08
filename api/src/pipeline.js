// Event ingestion: open / hint / run / submit -> progress, attempts, analysis, mastery, cards.
import { col } from "./db.js";
import { config } from "./config.js";
import { problemBySlug } from "./graph.js";
import { normalizeResult } from "./leetcode.js";
import { analyzeAttempt, autoTagProblem } from "./analysis.js";
import { deriveEvidence, applyEvidence, cleanliness } from "./mastery.js";
import { syncCards } from "./reviews.js";
import { resolveKey } from "./llm.js";

const now = () => new Date();

export async function resolveProblem({ slug, title, description, apiKey }) {
  if (problemBySlug.has(slug)) return { problem: problemBySlug.get(slug), source: "sheet" };
  const cached = await col.problemTags.findOne({ slug });
  if (cached) return { problem: cached.problem, source: "auto" };
  if (!apiKey || !title) return { problem: null, source: "none" };
  try {
    const problem = await autoTagProblem({ slug, title, description, apiKey });
    if (!problem.nodes.length) return { problem: null, source: "none" };
    await col.problemTags.updateOne({ slug }, { $set: { slug, problem, createdAt: now() } }, { upsert: true });
    return { problem, source: "auto" };
  } catch (e) {
    console.error("auto-tag failed", slug, e.message);
    return { problem: null, source: "none" };
  }
}

async function touchProgress(userId, slug, set = {}, inc = {}, at = now()) {
  const defaults = { createdAt: at, runs: 0, submits: 0, wrongSubmits: 0, hints: 0, solved: false };
  for (const k of [...Object.keys(inc), ...Object.keys(set)]) delete defaults[k]; // Mongo rejects overlapping paths
  return col.progress.findOneAndUpdate(
    { userId, slug },
    {
      $setOnInsert: { userId, slug, ...defaults },
      $set: { updatedAt: at, ...set },
      ...(Object.keys(inc).length ? { $inc: inc } : {}),
    },
    { upsert: true, returnDocument: "before" }
  );
}

export function shouldAnalyze(kind, verdict) {
  if (kind === "submit") return true;
  if (config.analyzeRuns === "none") return false;
  if (config.analyzeRuns === "failed") return verdict !== "Accepted";
  return true;
}

/** Handles one event from the extension. Returns quickly; analysis may continue in background. */
export async function ingestEvent(userId, body, { userKey = "", wait = false, at = now() } = {}) {
  const { type, slug } = body;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("invalid slug");

  if (type === "open") {
    await col.events.insertOne({ userId, type, slug, createdAt: at });
    await col.progress.updateOne(
      { userId, slug },
      {
        $setOnInsert: { userId, slug, createdAt: at, firstOpenedAt: at, runs: 0, submits: 0, wrongSubmits: 0, hints: 0, solved: false },
        $set: { lastOpenedAt: at, updatedAt: at, ...(body.title ? { title: body.title } : {}) },
      },
      { upsert: true }
    );
    return { ok: true };
  }

  if (type === "hint") {
    await col.events.insertOne({ userId, type, slug, prompt: String(body.prompt ?? "").slice(0, 500), createdAt: at });
    await touchProgress(userId, slug, body.title ? { title: body.title } : {}, { hints: 1 }, at);
    return { ok: true };
  }

  if (type !== "run" && type !== "submit") throw new Error("unknown event type");

  const result = normalizeResult(type, body.result ?? {}, { dataInput: body.dataInput });
  const apiKey = resolveKey(userKey);
  const { problem, source } = await resolveProblem({ slug, title: body.title, description: body.description, apiKey });

  const accepted = result.verdict === "Accepted";
  const before = await touchProgress(
    userId,
    slug,
    {
      lastAttemptAt: at,
      lastVerdict: result.verdict,
      ...(body.title ? { title: body.title } : {}),
      ...(problem ? { problemId: problem.id } : {}),
      ...(type === "submit" && accepted ? { solved: true } : {}),
    },
    type === "submit" ? { submits: 1, ...(accepted ? {} : { wrongSubmits: 1 }) } : { runs: 1 },
    at
  );
  if (type === "submit" && accepted && !before?.firstAcceptedAt) {
    await col.progress.updateOne({ userId, slug }, { $set: { firstAcceptedAt: at, firstTryAccepted: (before?.submits ?? 0) === 0 } });
  }

  const openedAt = before?.firstOpenedAt ?? before?.createdAt ?? at;
  const attempt = {
    userId, slug, kind: type,
    title: body.title ?? before?.title ?? slug,
    problemId: problem?.id ?? null,
    problemSource: source,
    lang: body.lang ?? "cpp",
    code: String(body.code ?? "").slice(0, 50000),
    verdict: result.verdict,
    result,
    progressBefore: {
      runs: before?.runs ?? 0, submits: before?.submits ?? 0,
      wrongSubmits: before?.wrongSubmits ?? 0, hints: before?.hints ?? 0,
    },
    msSinceOpen: Math.max(0, at - new Date(openedAt)),
    createdAt: at,
    analysis: { status: "pending" },
  };

  if (!problem) attempt.analysis = { status: "skipped", reason: apiKey ? "problem could not be mapped to the knowledge graph" : "no Gemini key — attempt stored, not graded" };
  else if (!shouldAnalyze(type, result.verdict)) attempt.analysis = { status: "skipped", reason: `runs with verdict ${result.verdict} are not analysed (ANALYZE_RUNS=${config.analyzeRuns})` };
  else if (!apiKey) attempt.analysis = { status: "skipped", reason: "no Gemini key — attempt stored, not graded" };

  const { insertedId } = await col.attempts.insertOne(attempt);
  attempt._id = insertedId;

  const job = processAttempt(attempt, problem, apiKey).catch((e) => console.error("processAttempt", e));
  if (wait) await job;
  return { ok: true, attemptId: insertedId, verdict: result.verdict, analysis: attempt.analysis.status };
}

/** Analysis + evidence + cards for one stored attempt. Safe to re-run (retry). */
export async function processAttempt(attempt, problem, apiKey) {
  let analysis = null;
  if (attempt.analysis.status === "pending") {
    try {
      analysis = await analyzeAttempt({ attempt, problem, progress: attempt.progressBefore, apiKey });
      await col.attempts.updateOne({ _id: attempt._id }, { $set: { analysis: { status: "done", ...analysis, analyzedAt: now() } } });
    } catch (e) {
      await col.attempts.updateOne({ _id: attempt._id }, { $set: { analysis: { status: "failed", error: e.message } } });
    }
  }

  let items = deriveEvidence({ attempt, problem, analysis, progress: attempt.progressBefore });
  // On a retry the verdict-based evidence was already counted the first time.
  if (attempt.evidenceApplied) items = items.filter((i) => i.source === "llm");
  await col.attempts.updateOne({ _id: attempt._id }, { $set: { evidenceApplied: true } });
  if (!items.length) return { analysis, changes: [] };
  const changes = await applyEvidence(attempt.userId, items, { attemptId: attempt._id, at: attempt.createdAt });
  const clean = attempt.kind === "submit" && attempt.verdict === "Accepted" ? cleanliness(attempt.progressBefore) : null;
  const cards = await syncCards(attempt.userId, changes, { now: attempt.createdAt, attemptId: attempt._id, cleanSolve: clean, apiKey });
  await col.attempts.updateOne(
    { _id: attempt._id },
    { $set: { masteryChanges: mergeChanges(changes), cardsCreated: cards.created.length, cardsReviewed: cards.reviewed.length } }
  );
  return { analysis, changes, cards };
}

// One entry per (node, facet): first "before" to last "after".
function mergeChanges(changes) {
  const out = new Map();
  for (const { node, facet, before, after } of changes) {
    const k = `${node}|${facet}`;
    const prev = out.get(k);
    out.set(k, { node, facet, from: prev ? prev.from : before.mastery, to: after.mastery, status: after.status });
  }
  return [...out.values()].map((c) => ({ ...c, polarity: c.to >= c.from ? "positive" : "negative" }));
}
