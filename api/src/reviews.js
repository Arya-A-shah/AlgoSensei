// Spaced repetition on (node, facet) pairs with FSRS.
// A facet gets a card once it is "learned" (solid with enough evidence). Fixing gaps
// is the job of the next-move engine; FSRS only keeps learned things from fading.
import { fsrs, generatorParameters, createEmptyCard, Rating, State } from "ts-fsrs";
import { Type } from "@google/genai";
import { col } from "./db.js";
import { graph, FACET_LABEL, FACET_BLOOM } from "./graph.js";
import { llmJson } from "./llm.js";
import { THRESHOLDS } from "./mastery.js";

export const scheduler = fsrs(generatorParameters({ enable_fuzz: true, enable_short_term: false, request_retention: 0.9 }));
export { Rating };

const CARD_MIN_EVIDENCE = 1.0;

const toFsrs = (c) => ({
  due: new Date(c.due), stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days ?? 0,
  scheduled_days: c.scheduled_days, reps: c.reps, lapses: c.lapses, learning_steps: c.learning_steps ?? 0,
  state: c.state, last_review: c.last_review ? new Date(c.last_review) : undefined,
});

const fromFsrs = (card) => ({
  due: card.due, stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days,
  scheduled_days: card.scheduled_days, reps: card.reps, lapses: card.lapses, learning_steps: card.learning_steps,
  state: card.state, last_review: card.last_review ?? null,
});

export function retrievability(card, now = new Date()) {
  if (!card || card.state === State.New) return null;
  return scheduler.get_retrievability(toFsrs(card), now, false);
}

async function review(cardDoc, rating, { now = new Date(), source, attemptId = null, answer = null }) {
  const { card, log } = scheduler.next(toFsrs(cardDoc), now, rating);
  const next = fromFsrs(card);
  await col.cards.updateOne({ _id: cardDoc._id }, { $set: { ...next, updatedAt: now } });
  await col.reviewLogs.insertOne({
    userId: cardDoc.userId, cardId: cardDoc._id, node: cardDoc.node, facet: cardDoc.facet,
    rating, ratingName: Rating[rating], source, attemptId, answer, reviewedAt: now,
    stateBefore: cardDoc.state, dueAfter: next.due, stabilityAfter: next.stability,
  });
  return { ...cardDoc, ...next };
}

/**
 * Called after mastery changes. Creates cards for newly learned facets, and turns
 * attempt outcomes into implicit reviews of existing cards.
 */
export async function syncCards(userId, changes, { now = new Date(), attemptId = null, cleanSolve = null, apiKey = "" } = {}) {
  const created = [];
  const reviewed = [];
  for (const ch of changes) {
    const key = { userId, node: ch.node, facet: ch.facet };
    const existing = await col.cards.findOne(key);

    if (!existing) {
      if (ch.after.status === "solid" && ch.after.evidence >= CARD_MIN_EVIDENCE) {
        // Learning already happened through practice: start the card with a "Good" review now.
        const first = scheduler.next(createEmptyCard(now), now, Rating.Good).card;
        const doc = { ...key, ...fromFsrs(first), createdAt: now, updatedAt: now };
        const { insertedId } = await col.cards.insertOne(doc);
        created.push({ _id: insertedId, ...doc });
        ensurePrompt(ch.node, ch.facet, "review", apiKey).catch(() => {});
      }
      continue;
    }

    if (ch.polarity === "negative") {
      // A pinpointed mistake on a learned facet is a lapse.
      reviewed.push(await review(existing, Rating.Again, { now, source: "attempt", attemptId }));
    } else if (cleanSolve !== null) {
      // Practising it counts as a review, but only once it is actually due-ish.
      const r = retrievability(existing, now);
      if (new Date(existing.due) <= now || (r !== null && r < 0.9)) {
        reviewed.push(await review(existing, cleanSolve >= 1 ? Rating.Good : Rating.Hard, { now, source: "attempt", attemptId }));
      }
    }
  }
  return { created, reviewed };
}

export async function gradeCard(userId, cardId, rating, { answer = null, now = new Date() } = {}) {
  const card = await col.cards.findOne({ _id: cardId, userId });
  if (!card) return null;
  return review(card, rating, { now, source: "manual", answer });
}

export async function dueCards(userId, { now = new Date(), limit = 50 } = {}) {
  const cards = await col.cards.find({ userId, due: { $lte: now } }).sort({ due: 1 }).limit(limit).toArray();
  return cards;
}

export async function upcomingCards(userId, { now = new Date(), limit = 20 } = {}) {
  return col.cards.find({ userId, due: { $gt: now } }).sort({ due: 1 }).limit(limit).toArray();
}

// ---------- prompts (review cards and remediation drills) ----------

const PROMPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    variants: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          code: { type: Type.STRING, nullable: true },
          answer: { type: Type.STRING },
          hint: { type: Type.STRING },
        },
        required: ["question", "answer"],
      },
    },
  },
  required: ["variants"],
};

const KIND_BRIEF = {
  review:
    "a short spaced-repetition review question (answerable in 1-3 minutes, in your head or on paper)",
  drill:
    "a focused micro-drill that isolates exactly this facet: e.g. fix a buggy C++ snippet, predict state after N steps, choose the right technique for a mini scenario. It must NOT be a full LeetCode problem",
};

const FACET_STYLE = {
  recognize: "Give a mini problem statement and ask which technique/structure fits and why.",
  explain: "Ask WHY it works, what invariant holds, or what it costs.",
  implement: "Show a short C++ snippet with one realistic bug (or a blank to fill) and ask for the fix.",
  trace: "Give a tiny input and ask for the exact variable/array state after specific steps.",
  adapt: "Change one condition of a known problem (edge case, variant) and ask what must change.",
};

const TEMPLATE_QUESTION = {
  recognize: (n) => `When should you reach for ${n.name}? Name two problems where it is the key idea, and the words in each statement that signal it.`,
  explain: (n) => `Explain in your own words why ${n.name} works — what stays true at every step, and what it costs in time and space.`,
  implement: (n) => `Write the core of ${n.name} in C++ from memory, on paper, as you would inside a solution. Then compare it with the answer and the traps listed there.`,
  trace: (n) => `Pick a 5-element input that exercises ${n.name} and trace it by hand, writing the value of every variable after each step.`,
  adapt: (n) => `Take a problem that uses ${n.name} and change one condition (duplicates, negatives, k ≥ n, an empty input). What must change in your code, and why?`,
};

export function templatePrompt(nodeId, facet, kind) {
  const n = graph.nodes.get(nodeId);
  const traps = (n.misconceptions ?? []).filter((m) => m.facet === facet).map((m) => `• ${m.desc}`);
  const allTraps = traps.length ? traps : (n.misconceptions ?? []).slice(0, 3).map((m) => `• ${m.desc}`);
  const question = kind === "drill"
    ? `${TEMPLATE_QUESTION[facet](n)}${allTraps.length ? `\n\nBefore revealing, check your work against each of these:\n${allTraps.join("\n")}` : ""}`
    : TEMPLATE_QUESTION[facet](n);
  return {
    node: nodeId, facet, kind, generatedBy: "template",
    variants: [{
      question,
      code: null,
      answer: `What good looks like: ${n.facets[facet]}\n\n${n.description}${kind !== "drill" && allTraps.length ? `\n\nCommon traps:\n${allTraps.join("\n")}` : ""}`,
      hint: allTraps[0]?.replace(/^• /, "Watch for: ") ?? n.facets[facet],
    }],
  };
}

export async function ensurePrompt(nodeId, facet, kind = "review", apiKey = "") {
  const cached = await col.prompts.findOne({ node: nodeId, facet, kind });
  if (cached && (cached.generatedBy !== "template" || !apiKey)) return cached;
  if (!apiKey) return templatePrompt(nodeId, facet, kind);

  const n = graph.nodes.get(nodeId);
  const prompt = `Create ${KIND_BRIEF[kind]} for a learner practising DSA in C++.

CONCEPT: ${n.name} (${nodeId})
${n.description}
FACET: ${facet} — ${n.facets[facet]}
Bloom's level: ${FACET_BLOOM[facet]}
Style: ${FACET_STYLE[facet]}
Known misconceptions for this facet:
${(n.misconceptions ?? []).filter((m) => m.facet === facet).map((m) => `- ${m.id}: ${m.desc}`).join("\n") || "- (none listed)"}

Return 3 distinct variants. Each has: question (plain text), code (C++ snippet or null), answer (the model answer with the reasoning, 2-6 lines), hint (one nudge, no spoiler). Target the misconceptions above.`;
  try {
    const raw = await llmJson({ apiKey, prompt, schema: PROMPT_SCHEMA });
    const variants = (raw?.variants ?? []).filter((v) => v.question && v.answer).slice(0, 3);
    if (!variants.length) throw new Error("no variants");
    const doc = { node: nodeId, facet, kind, generatedBy: "llm", variants, createdAt: new Date() };
    await col.prompts.updateOne({ node: nodeId, facet, kind }, { $set: doc }, { upsert: true });
    return doc;
  } catch {
    return cached ?? templatePrompt(nodeId, facet, kind);
  }
}

export function pickVariant(promptDoc, reps = 0) {
  const v = promptDoc.variants;
  return { ...v[reps % v.length], index: reps % v.length, total: v.length, generatedBy: promptDoc.generatedBy };
}

export { State, THRESHOLDS };
