// Shared labels. Plain words; the theme lives in the visuals, not the vocabulary.

export const LAYERS = {
  3: { name: "Patterns", blurb: "Techniques that solve whole families of problems" },
  2: { name: "Data structures", blurb: "What each structure is for and what it costs" },
  0: { name: "Basics", blurb: "Indexing, loops, initialization: what every solution stands on" },
  1: { name: "C++", blurb: "Language and STL details" },
  4: { name: "Reasoning", blurb: "Reading problems, edge cases, complexity" },
};
export const LAYER_ORDER = [3, 2, 0, 1, 4];

export const FACETS = ["recognize", "explain", "implement", "trace", "adapt"];
export const FACET = {
  recognize: { name: "Recognize", what: "Know when to use it" },
  explain: { name: "Explain", what: "Know why it works" },
  implement: { name: "Implement", what: "Write it correctly" },
  trace: { name: "Trace", what: "Follow it step by step" },
  adapt: { name: "Adapt", what: "Handle variants and edge cases" },
};

export const STATUS = {
  weak: { name: "Weak" },
  shaky: { name: "Shaky" },
  solid: { name: "Solid" },
  unknown: { name: "Not seen" },
};

export const PROBLEM_STATE = { solved: "Solved", attempted: "Attempted", new: "Not started" };
export const SECTION = { fundamentals: "Basics", logic_building: "Logic", faq_medium: "Medium", faq_hard: "Hard" };

// "Tracking extremes (largest / second largest)" -> "Tracking extremes"
export const shortName = (name = "") =>
  name.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+&\s+.*$/, "").replace(/\s*->\s*/g, " → ").trim();

// A concept's belt: how many of its tested facets are solid.
export const BELTS = [
  { name: "White", color: "#f4f1ea" },
  { name: "Yellow", color: "#e9c440" },
  { name: "Orange", color: "#e2832b" },
  { name: "Green", color: "#4f8a3a" },
  { name: "Brown", color: "#7a4a26" },
  { name: "Black", color: "#1f1b18" },
];
export function beltFor(facets = {}) {
  const defined = FACETS.filter((f) => facets[f]);
  if (!defined.some((f) => facets[f].status !== "unknown")) return null;
  const solid = defined.filter((f) => facets[f].status === "solid").length;
  return { ...BELTS[Math.min(solid, 5)], solid, total: defined.length };
}

const DO = {
  recognize: "Practise spotting when it applies",
  explain: "Make sure you can explain why it works",
  implement: "Practise coding it",
  trace: "Trace it by hand on a small input",
  adapt: "Practise its edge cases",
};

export const MOVE_LABEL = { fix: "Fix", revise: "Review", finish: "Finish", advance: "Next problem" };

// One plain instruction per recommended move.
export function instruction(move) {
  if (!move) return { say: "Open a problem on LeetCode and run your code. Your first gaps will show up here.", act: null };
  const d = move.detail ?? {};
  if (move.type === "fix") {
    return {
      say: `${shortName(d.nodeName)} is your weakest spot. ${DO[d.facet] ?? "Practise it"}.`,
      why: d.misconceptions?.[0] ? `Seen in your code: ${d.misconceptions[0].desc}` : null,
      act: { label: "Start drill", kind: "drill" },
    };
  }
  if (move.type === "revise") {
    return {
      say: `${d.count} concept${d.count === 1 ? " is" : "s are"} due for review.`,
      why: d.nodes?.length ? d.nodes.slice(0, 3).map(shortName).join(", ") : null,
      act: { label: "Review now", href: "#/practice" },
    };
  }
  if (move.type === "finish") {
    const title = move.title.replace(/^Finish\s+"?|"$/g, "");
    return {
      say: `Finish ${title}.`,
      why: d.lastVerdict ? `Last result: ${d.lastVerdict}` : null,
      act: d.slug ? { label: "Open on LeetCode", href: `https://leetcode.com/problems/${d.slug}/`, external: true } : null,
    };
  }
  if (move.type === "advance") {
    const title = move.title.replace(/^Next problem:\s*/, "");
    return {
      say: `You're ready for ${title}.`,
      why: d.core?.length ? `It teaches ${d.core.map(shortName).join(", ")}.` : null,
      act: d.problemId ? { label: "See problem", href: `#/p/${d.problemId}` } : null,
    };
  }
  return { say: move.title, act: null };
}
