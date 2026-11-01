// The game vocabulary: how knowledge-graph layers, nodes and moves read as a dojo.

// Each knowledge-graph layer is a room of the dojo.
export const SCHOOLS = {
  0: { key: "stances", name: "Stances", blurb: "Basics every move stands on", glyph: "stance" },
  1: { key: "craft", name: "C++ craft", blurb: "Your language and its tools", glyph: "forge" },
  2: { key: "weapons", name: "Weapons", blurb: "Data structures", glyph: "weapon" },
  3: { key: "techniques", name: "Techniques", blurb: "Patterns that win fights", glyph: "strike" },
  4: { key: "mind", name: "Mind", blurb: "How you think a problem through", glyph: "mind" },
};
export const SCHOOL_ORDER = [3, 2, 0, 1, 4];

// Data structures are weapons.
export const WEAPONS = {
  "ds.array": { weapon: "Bo staff", art: "staff", line: "Long reach, one step at a time." },
  "ds.sorted_array": { weapon: "Katana", art: "katana", line: "Order makes every cut count." },
  "ds.matrix": { weapon: "Grid shield", art: "shield", line: "Rows and columns, held as one." },
  "ds.hashmap": { weapon: "Shuriken", art: "shuriken", line: "Hits any key in one throw." },
  "ds.hashset": { weapon: "Kunai", art: "kunai", line: "Knows at once if it has seen you." },
};

// Facets are the five ways a skill is tested.
export const FACETS = ["recognize", "explain", "implement", "trace", "adapt"];
export const FACET = {
  recognize: { name: "Spot", full: "Recognize", what: "Know when to use it" },
  explain: { name: "Explain", full: "Explain", what: "Know why it works" },
  implement: { name: "Code", full: "Implement", what: "Write it correctly" },
  trace: { name: "Trace", full: "Trace", what: "Follow it step by step" },
  adapt: { name: "Adapt", full: "Adapt", what: "Handle twists and edge cases" },
};

export const STATUS = {
  weak: { name: "Weak", color: "var(--blood)" },
  shaky: { name: "Shaky", color: "var(--amber)" },
  solid: { name: "Solid", color: "var(--jade)" },
  unknown: { name: "Not seen", color: "var(--ash)" },
};

// "Tracking extremes (largest / second largest)" -> "Tracking extremes"
export const shortName = (name = "") => name.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+&\s+.*$/, "").replace(/\s*->\s*/g, " → ").trim();

// Belts are earned by solving sheet problems, as a share of the whole sheet.
export const BELTS = [
  { name: "White", color: "#ece4d6", share: 0 },
  { name: "Yellow", color: "#f2cf4a", share: 0.09 },
  { name: "Orange", color: "#ef8a2f", share: 0.22 },
  { name: "Green", color: "#3fa45f", share: 0.375 },
  { name: "Blue", color: "#3a7bd5", share: 0.56 },
  { name: "Brown", color: "#7a4a26", share: 0.75 },
  { name: "Black", color: "#121014", share: 0.94 },
];

export function beltRank(solved = 0, total = 32) {
  const steps = BELTS.map((b) => ({ ...b, at: Math.max(b.share ? 1 : 0, Math.round(b.share * total)) }));
  let i = 0;
  while (i + 1 < steps.length && solved >= steps[i + 1].at) i++;
  const next = steps[i + 1] ?? null;
  return { ...steps[i], index: i, next, toNext: next ? next.at - solved : 0 };
}

// A skill's own belt: how many of its tested facets are solid.
export function skillLevel(facets = {}) {
  const defined = FACETS.filter((f) => facets[f]);
  const solid = defined.filter((f) => facets[f].status === "solid").length;
  const seen = defined.some((f) => facets[f].status !== "unknown");
  return { solid, total: defined.length, seen, mastered: defined.length > 0 && solid === defined.length };
}

const DRILL_VERB = {
  recognize: "Learn when to reach for it",
  explain: "Learn why it works",
  implement: "Drill the code",
  trace: "Trace it by hand",
  adapt: "Practise the edge cases",
};

// Turns a next-move from the API into one short line from the sensei.
export function senseiLine(move) {
  if (!move) return { say: "Pick a problem. Run your code. I'll be watching.", act: null };
  const d = move.detail ?? {};
  if (move.type === "fix") {
    return {
      say: `${shortName(d.nodeName)} is your weak spot. ${DRILL_VERB[d.facet] ?? "Train it"}.`,
      why: d.misconceptions?.[0]?.desc ?? null,
      act: { label: "Train now", kind: "drill" },
    };
  }
  if (move.type === "revise") {
    return {
      say: `${d.count} skill${d.count === 1 ? " is" : "s are"} fading. Spar before you forget.`,
      why: d.nodes?.length ? d.nodes.slice(0, 3).map(shortName).join(", ") : null,
      act: { label: "Enter the arena", href: "#/arena" },
    };
  }
  if (move.type === "finish") {
    const title = move.title.replace(/^Finish\s+"?|"$/g, "");
    return {
      say: `Unfinished fight: ${title}. Go back in.`,
      why: d.lastVerdict ? `Last result: ${d.lastVerdict}` : null,
      act: d.slug ? { label: "Fight on LeetCode", href: `https://leetcode.com/problems/${d.slug}/`, external: true } : null,
    };
  }
  if (move.type === "advance") {
    const title = move.title.replace(/^Next problem:\s*/, "");
    return {
      say: `You're ready. Next opponent: ${title}.`,
      why: d.core?.length ? `Teaches ${d.core.map(shortName).join(", ")}` : null,
      act: d.problemId ? { label: "See the fight", href: `#/p/${d.problemId}` } : null,
    };
  }
  return { say: move.title, act: null };
}

export const MOVE_TAG = { fix: "Train", revise: "Spar", finish: "Rematch", advance: "Next fight" };
