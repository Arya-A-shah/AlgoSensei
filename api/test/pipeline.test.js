// Integration tests: real routes + real Mongo-compatible DB, stubbed LLM.
//   MONGODB_URI=mongodb://127.0.0.1:27017 npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { connectDb, closeDb, db, col } from "../src/db.js";
import { app } from "../src/index.js";
import { setLlm } from "../src/llm.js";
import { normalizeResult } from "../src/leetcode.js";
import { sanitizeAnalysis } from "../src/analysis.js";
import { buildContextPack, graph } from "../src/graph.js";
import { nextMoves } from "../src/recommend.js";

const DB = `dmm_test_${Date.now()}`;
let token;
const llmCalls = [];

const KADANE_BUGGY = `int maxSubArray(vector<int>& nums) {
  int sum = 0, best = 0;
  for (int x : nums) { sum += x; if (sum < 0) sum = 0; best = max(best, sum); }
  return best;
}`;
const KADANE_GOOD = `int maxSubArray(vector<int>& nums) {
  long long sum = 0, best = LLONG_MIN;
  for (int x : nums) { sum += x; best = max(best, sum); if (sum < 0) sum = 0; }
  return best;
}`;

// Stub LLM: answers based on what the prompt contains.
function stubLlm({ prompt }) {
  llmCalls.push(prompt.slice(0, 80));
  if (prompt.includes("You map competitive-programming problems")) {
    return { summary: "Auto-tagged", tier: "Core", nodes: [{ id: "p.two_pointers_opposite", role: "core", facets: ["implement", "bogus"] }, { id: "nope.node", role: "core", facets: [] }], approaches: [{ level: "optimal", name: "Two pointers", demonstrates: ["p.two_pointers_opposite", "x.y"] }], watch_for: ["p.opp.wrong_move", "fake.id"] };
  }
  if (prompt.includes("Return 3 distinct variants")) {
    return { variants: [{ question: "Q1?", answer: "A1", hint: "H1", code: null }, { question: "Q2?", answer: "A2", hint: "H2", code: "int x;" }] };
  }
  if (prompt.includes("best = 0")) {
    return {
      approach_level: "optimal", approach_name: "Kadane", summary: "Right idea, but the tracker start value breaks on some inputs.",
      findings: [
        { node: "p.kadane", facet: "implement", polarity: "negative", misconception: "p.kadane.all_negative", evidence: "best = 0", confidence: 0.9 },
        { node: "p.kadane", facet: "recognize", polarity: "positive", misconception: null, evidence: "single pass", confidence: 0.8 },
        { node: "made.up", facet: "implement", polarity: "negative", misconception: "made.up.id", evidence: "x", confidence: 1 },
      ],
      root_cause: "u.init.max_zero",
    };
  }
  return {
    approach_level: "optimal", approach_name: "Kadane", summary: "Clean single pass.",
    findings: [
      { node: "p.kadane", facet: "implement", polarity: "positive", evidence: "update then reset", confidence: 0.95 },
      { node: "p.kadane", facet: "explain", polarity: "positive", evidence: "LLONG_MIN start", confidence: 0.8 },
    ],
    root_cause: null,
  };
}

const call = async (method, path, body, headers = {}) => {
  const res = await app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "X-User-Token": token } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};
const settle = () => new Promise((r) => setTimeout(r, 150));

before(async () => {
  await connectDb(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017", DB);
  setLlm(stubLlm);
});
after(async () => {
  await db.dropDatabase();
  await closeDb();
});

test("normalizeResult: run with wrong answer is not 'Accepted'", () => {
  const r = normalizeResult("run", { status_code: 10, status_msg: "Accepted", run_success: true, correct_answer: false, compare_result: "10", code_answer: ["6", "0"], expected_code_answer: ["6", "-1"] });
  assert.equal(r.verdict, "Wrong Answer");
  assert.equal(r.expectedOutput, "-1");
  assert.equal(r.codeOutput, "0");
  const s = normalizeResult("submit", { status_code: 14, status_msg: "Time Limit Exceeded", total_correct: 200, total_testcases: 210 });
  assert.equal(s.verdict, "Time Limit Exceeded");
  assert.equal(s.totalCorrect, 200);
});

test("sanitizeAnalysis drops unknown ids and repairs facets from the misconception", () => {
  const pack = buildContextPack(graph, graph.problems.get("arr.kadane"));
  const out = sanitizeAnalysis({
    approach_level: "optimal",
    findings: [
      { node: "p.kadane", facet: "trace", polarity: "negative", misconception: "p.kadane.reset_order", evidence: "", confidence: 2 },
      { node: "zzz", facet: "implement", polarity: "positive", evidence: "", confidence: 0.5 },
      { node: "p.kadane", facet: "implement", polarity: "negative", misconception: "p.dnf.loop_condition", evidence: "", confidence: 0.5 },
    ],
  }, pack);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].facet, "implement"); // repaired from misconception definition
  assert.equal(out.findings[0].confidence, 1); // clamped
  assert.equal(out.dropped.length, 2);
});

test("register + auth", async () => {
  const r = await call("POST", "/api/register");
  assert.equal(r.status, 200);
  token = r.json.token;
  assert.ok(token && r.json.userId);
  const bad = await app.request("/api/me/overview", { headers: { "X-User-Token": "nope" } });
  assert.equal(bad.status, 401);
});

test("full loop on Kadane: open -> failed run -> wrong submit -> accepted submit", async () => {
  await call("POST", "/api/events", { type: "open", slug: "maximum-subarray", title: "53. Maximum Subarray" });

  const run = await call("POST", "/api/events", {
    type: "run", slug: "maximum-subarray", title: "53. Maximum Subarray", lang: "cpp", code: KADANE_BUGGY,
    result: { status_code: 10, run_success: true, correct_answer: false, compare_result: "10", code_answer: ["6", "0"], expected_code_answer: ["6", "-1"] },
  }, { "X-Gemini-Key": "test-key" });
  assert.equal(run.status, 200);
  assert.equal(run.json.verdict, "Wrong Answer");
  await settle();

  const wrong = await call("POST", "/api/events", {
    type: "submit", slug: "maximum-subarray", lang: "cpp", code: KADANE_BUGGY,
    result: { status_code: 11, status_msg: "Wrong Answer", total_correct: 201, total_testcases: 210, last_testcase: "[-1]", expected_output: "-1", code_output: "0" },
  }, { "X-Gemini-Key": "test-key" });
  assert.equal(wrong.json.analysis, "pending");
  await settle();

  const detail = await call("GET", `/api/me/attempts/${wrong.json.attemptId}`);
  const a = detail.json.attempt;
  assert.equal(a.analysis.status, "done");
  assert.equal(a.problemId, "arr.kadane");
  assert.equal(a.analysis.findings.length, 3, "made-up ids dropped, root cause added as a finding");
  assert.ok(a.analysis.findings.some((f) => f.misconception === "u.init.max_zero" && f.node === "u.variable_init"));
  assert.equal(a.analysis.rootCause, "u.init.max_zero");
  assert.ok(a.masteryChanges.some((m) => m.node === "p.kadane" && m.facet === "implement" && m.polarity === "negative"));

  // The weak facet should surface as the top "fix" move.
  const next = await call("GET", "/api/me/next");
  const fix = next.json.moves.find((m) => m.type === "fix");
  assert.ok(fix, "a fix move exists");
  // The deepest weak prerequisite wins: initialization, surfaced via Kadane.
  assert.equal(fix.detail.node, "u.variable_init");
  assert.ok(fix.detail.surfacedVia.some((v) => v.startsWith("p.kadane")));
  assert.match(fix.reason, /max tracker to 0/);
  assert.ok(fix.detail.drill?.question, "fix move carries a drill");
  assert.ok(fix.detail.practice.length > 0);
  assert.ok(next.json.moves.some((m) => m.type === "finish"), "unsolved attempted problem shows up");

  // Accepted, repeated until the facet is solid -> a review card appears.
  for (let i = 0; i < 4; i++) {
    const ok = await call("POST", "/api/events", {
      type: "submit", slug: "maximum-subarray", lang: "cpp", code: KADANE_GOOD,
      result: { status_code: 10, status_msg: "Accepted", total_correct: 210, total_testcases: 210, status_runtime: "0 ms", runtime_percentile: 100 },
    }, { "X-Gemini-Key": "test-key" });
    assert.equal(ok.json.verdict, "Accepted");
    await settle();
  }
  const prog = await col.progress.findOne({ slug: "maximum-subarray" });
  assert.equal(prog.solved, true);
  assert.equal(prog.firstTryAccepted, false);
  assert.equal(prog.wrongSubmits, 1);

  const ov = await call("GET", "/api/me/overview");
  const kad = ov.json.layers.flatMap((l) => l.nodes).find((n) => n.id === "p.kadane");
  assert.ok(kad.facets.implement.mastery > 0.5);
  assert.equal(kad.misconceptionsSeen[0].id, "p.kadane.all_negative");
  assert.equal(ov.json.sheet.find((p) => p.id === "arr.kadane").status, "solved");
  assert.equal(ov.json.stats.solved, 1);
  assert.ok(ov.json.stats.cardsTotal >= 1, "learned facets get FSRS cards");
});

test("revision: due card can be graded and gets rescheduled", async () => {
  await col.cards.updateMany({}, { $set: { due: new Date(Date.now() - 864e5) } });
  const r = await call("GET", "/api/me/reviews");
  assert.ok(r.json.due.length >= 1);
  const card = r.json.due[0];
  assert.ok(card.prompt.question);
  assert.equal(card.bloom.length > 0, true);
  const g = await call("POST", `/api/me/reviews/${card.id}`, { rating: 3, answer: "because..." });
  assert.equal(g.status, 200);
  assert.ok(new Date(g.json.due) > new Date());
  const bad = await call("POST", `/api/me/reviews/${card.id}`, { rating: 9 });
  assert.equal(bad.status, 400);
});

test("unknown problem is auto-tagged once, ids sanitized, and cached", async () => {
  const before = llmCalls.filter((c) => c.includes("You map")).length;
  const ev = { type: "submit", slug: "container-with-most-water", title: "11. Container With Most Water", description: "two lines...", lang: "cpp", code: "int x;", result: { status_code: 10, status_msg: "Accepted", total_correct: 1, total_testcases: 1 } };
  await call("POST", "/api/events", ev, { "X-Gemini-Key": "k" });
  await settle();
  await call("POST", "/api/events", ev, { "X-Gemini-Key": "k" });
  await settle();
  assert.equal(llmCalls.filter((c) => c.includes("You map")).length - before, 1, "tagged once, then cached");
  const tag = await col.problemTags.findOne({ slug: "container-with-most-water" });
  assert.deepEqual(tag.problem.nodes, [{ id: "p.two_pointers_opposite", role: "core", facets: ["implement"] }]);
  assert.deepEqual(tag.problem.watch_for, ["p.opp.wrong_move"]);
});

test("without any Gemini key attempts are stored but not graded", async () => {
  const r = await call("POST", "/api/events", { type: "submit", slug: "move-zeroes", lang: "cpp", code: "x", result: { status_code: 11, status_msg: "Wrong Answer" } });
  assert.equal(r.json.analysis, "skipped");
  const list = await call("GET", "/api/me/attempts?slug=move-zeroes");
  assert.equal(list.json.attempts.length, 1);
  assert.equal(list.json.attempts[0].analysis.status, "skipped");
});

test("hints count toward progress via /hint's X-User-Token", async () => {
  const user = await col.users.findOne({});
  await nextMoves(user._id); // smoke
  await call("POST", "/api/events", { type: "hint", slug: "two-sum", title: "1. Two Sum" });
  const p = await col.progress.findOne({ userId: user._id, slug: "two-sum" });
  assert.equal(p.hints, 1);
});
