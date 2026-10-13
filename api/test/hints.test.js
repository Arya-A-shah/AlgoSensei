// Unit tests for the hint ladder and hint-aware solve credit. No database needed:
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardSpoilers, sanitizeHint, buildHintPrompt, weakFacetsFor, describeLastAttempt, clampLevel, HINT_LEVELS } from "../src/hints.js";
import { buildContextPack, graph } from "../src/graph.js";
import { cleanliness, HINT_FACTOR } from "../src/mastery.js";

const kadane = buildContextPack(graph, graph.problems.get("arr.kadane"));

test("clampLevel keeps hints on the 1..3 ladder", () => {
  assert.equal(clampLevel(0), 1);
  assert.equal(clampLevel("2"), 2);
  assert.equal(clampLevel(9), 3);
  assert.equal(clampLevel("nope"), 1);
  assert.deepEqual(Object.keys(HINT_LEVELS), ["1", "2", "3"]);
});

test("guardSpoilers strips solution-sized code but keeps short quotes", () => {
  const solution = "Try this:\n```cpp\nint maxSubArray(vector<int>& nums) {\n  long long s = 0, b = LLONG_MIN;\n  for (int x : nums) { s += x; b = max(b, s); if (s < 0) s = 0; }\n  return b;\n}\n```";
  const g1 = guardSpoilers(solution);
  assert.equal(g1.stripped, true);
  assert.doesNotMatch(g1.text, /LLONG_MIN/);

  const quote = "Look at this line:\n```\nint best = 0;\n```\nWhat if every number is negative?";
  const g2 = guardSpoilers(quote);
  assert.equal(g2.stripped, false);
  assert.match(g2.text, /int best = 0;/);

  const inline = "Just write class Solution { public: int f() { return 1; } };";
  assert.equal(guardSpoilers(inline).stripped, true);
});

test("sanitizeHint: ids must come from the pack, level 1 hides the concept", () => {
  const raw = {
    focus_node: "p.kadane",
    misconception: "u.init.max_zero",
    questions: ["What does your tracker hold before the first element?", "What if every number is negative?", "third question dropped"],
    observation: "Your starting value decides the answer on some inputs.",
    nudge: "You're close.",
  };
  const l1 = sanitizeHint(raw, { level: 1, pack: kadane });
  assert.equal(l1.focusNode, null, "a nudge does not name the concept");
  assert.equal(l1._focusNode, "p.kadane", "but it is kept for bookkeeping");
  assert.equal(l1.misconception, "u.init.max_zero");
  assert.equal(l1.questions.length, 2);
  assert.equal(l1.nextLevel, 2);
  assert.match(l1.text, /Think about this/);

  const l2 = sanitizeHint(raw, { level: 2, pack: kadane });
  assert.equal(l2.focusNode, "p.kadane");
  assert.equal(l2.focusName, graph.nodes.get("p.kadane").name);

  const l3 = sanitizeHint({ ...raw, focus_node: "made.up", misconception: "p.dnf.mid_after_high_swap" }, { level: 3, pack: kadane });
  assert.equal(l3.misconception, null, "a misconception outside this problem's pack is dropped");
  assert.equal(l3.focusNode, null);
  assert.equal(l3.nextLevel, null);

  // Focus is inferred from a valid misconception when the model leaves it out.
  const inferred = sanitizeHint({ ...raw, focus_node: null }, { level: 2, pack: kadane });
  assert.equal(inferred.focusNode, graph.misconceptions.get("u.init.max_zero").node);

  const empty = sanitizeHint({}, { level: 1, pack: null });
  assert.ok(empty.text.length > 20, "always returns something usable");
});

test("buildHintPrompt carries the pack, last attempt, weak facets and earlier hints", () => {
  const last = describeLastAttempt({
    kind: "submit", verdict: "Wrong Answer", code: "x",
    result: { totalCorrect: 201, totalTestcases: 210, lastTestcase: "[-1]", expectedOutput: "-1", codeOutput: "0" },
    analysis: { rootCause: "u.init.max_zero" },
  });
  last.sameCode = true;
  const prompt = buildHintPrompt({
    title: "53. Maximum Subarray", description: "Find the subarray with the largest sum.", code: "int best = 0;",
    question: "why does [-1] fail?", level: 2, pack: kadane, last,
    weak: [{ node: "p.kadane", name: "Kadane", facet: "implement", facetLabel: "Implement", mastery: 0.3, status: "weak", misconceptions: ["p.kadane.all_negative"] }],
    previous: [{ level: 1, text: "What does your tracker hold before the first element?" }],
  });
  assert.match(prompt, /HINT LEVEL 2 of 3 — CONCEPT/);
  assert.match(prompt, /Failing input: \[-1\]/);
  assert.match(prompt, /201\/210/);
  assert.match(prompt, /unchanged since then/);
  assert.match(prompt, /u\.init\.max_zero/);
  assert.match(prompt, /Kadane · Implement: weak \(30%\)/);
  assert.match(prompt, /level 1: What does your tracker hold/);
  assert.match(prompt, /p\.kadane/);

  const bare = buildHintPrompt({ title: "x", description: "", code: "", question: "", level: 1, pack: null, last: null, weak: [] });
  assert.match(bare, /not mapped to the knowledge graph/);
  assert.match(bare, /No run or submit captured yet/);
});

test("weakFacetsFor picks non-solid facets of this problem's nodes, weakest first", () => {
  const log = [{ polarity: "negative", misconception: "p.kadane.all_negative" }, { polarity: "negative", misconception: "p.kadane.all_negative" }];
  const mastery = new Map([
    ["p.kadane", { implement: { mastery: 0.3, evidence: 2, status: "weak", log }, recognize: { mastery: 0.9, evidence: 3, status: "solid", log: [] } }],
    ["u.variable_init", { implement: { mastery: 0.55, evidence: 1, status: "shaky", log: [] } }],
    ["p.dutch_national_flag", { implement: { mastery: 0.1, evidence: 3, status: "weak", log: [] } }], // not in this pack
    ["u.swap", { implement: { mastery: 0.2, evidence: 0.2, status: "unknown", log: [] } }], // too little evidence
  ]);
  const weak = weakFacetsFor(kadane, mastery);
  assert.deepEqual(weak.map((w) => `${w.node}|${w.facet}`), ["p.kadane|implement", "u.variable_init|implement"]);
  assert.deepEqual(weak[0].misconceptions, ["p.kadane.all_negative"]);
});

test("cleanliness: deeper hints cost more credit; legacy hints keep their old weight", () => {
  assert.equal(cleanliness({ wrongSubmits: 0, hints: 0 }), 1);
  assert.equal(cleanliness({ wrongSubmits: 0, hints: 2, maxHintLevel: 1 }), HINT_FACTOR[1]);
  assert.equal(cleanliness({ wrongSubmits: 0, hints: 1, maxHintLevel: 3 }), HINT_FACTOR[3]);
  assert.ok(HINT_FACTOR[1] > HINT_FACTOR[2] && HINT_FACTOR[2] > HINT_FACTOR[3]);
  assert.equal(cleanliness({ wrongSubmits: 0, hints: 1 }), 0.7, "pre-ladder hint");
  assert.equal(cleanliness({ wrongSubmits: 5, hints: 1, maxHintLevel: 3 }), 0.35, "floored");
});
