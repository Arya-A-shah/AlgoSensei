// Creates a demo learner with ~3 weeks of realistic history so the dashboard can be
// explored before the extension has collected real data.
//   npm run seed            -> prints the dashboard link for the demo user
// Grading is scripted (no Gemini calls); everything else runs through the real pipeline.
import { connectDb, closeDb } from "../src/db.js";
import { config } from "../src/config.js";
import { registerUser } from "../src/auth.js";
import { ingestEvent } from "../src/pipeline.js";
import { setLlm } from "../src/llm.js";

const DAY = 864e5;
const scripted = new Map();
let seq = 0;

const neg = (node, facet, misconception, evidence, confidence = 0.85) => ({ node, facet, polarity: "negative", misconception, evidence, confidence });
const pos = (node, facet, evidence, confidence = 0.85) => ({ node, facet, polarity: "positive", misconception: null, evidence, confidence });

// [daysAgo, slug, title, kind, verdict, analysis]
const A = (approach_level, approach_name, summary, findings, root_cause = null) => ({ approach_level, approach_name, summary, findings, root_cause });
const STORY = [
  [18, "two-sum", "1. Two Sum", "run", "Wrong Answer", A("better", "Hashmap of value -> index, look up complement", "You reached for a hashmap straight away — good instinct. The order of two operations in your loop lets an element pair with itself.", [neg("p.complement_lookup", "implement", "p.comp.insert_before_check", "mp[nums[i]] = i; before the lookup"), pos("ds.hashmap", "recognize", "chose value->index map")], "p.comp.insert_before_check")],
  [18, "two-sum", "1. Two Sum", "submit", "Accepted", A("better", "Hashmap of value -> index, look up complement", "Clean one-pass complement lookup.", [pos("p.complement_lookup", "implement", "lookup before insert"), pos("ds.hashmap", "implement", "value -> index mapping"), pos("p.complement_lookup", "recognize", "pair search as complement lookup")])],
  [17, "move-zeroes", "283. Move Zeroes", "submit", "Accepted", A("optimal", "Read/write pointers with swap", "Read/write pointers with the invariant held throughout.", [pos("p.two_pointers_same_dir", "implement", "write advances only on non-zero"), pos("p.two_pointers_same_dir", "recognize", "in-place compaction"), pos("u.swap", "implement", "std::swap")])],
  [16, "remove-duplicates-from-sorted-array", "26. Remove Duplicates from Sorted Array", "submit", "Wrong Answer", A("optimal", "Read/write pointers comparing with last kept", "The scan itself is right; what you hand back to the caller is off.", [neg("p.two_pointers_same_dir", "implement", "p.rw.return_count_off", "return i;"), pos("ds.sorted_array", "recognize", "compares with previous kept element")], "p.rw.return_count_off")],
  [16, "remove-duplicates-from-sorted-array", "26. Remove Duplicates from Sorted Array", "submit", "Accepted", A("optimal", "Read/write pointers comparing with last kept", "Fixed the count; solid use of sortedness.", [pos("p.two_pointers_same_dir", "implement", "return i + 1"), pos("ds.sorted_array", "explain", "duplicates are adjacent")])],
  [15, "max-consecutive-ones", "485. Max Consecutive Ones", "submit", "Wrong Answer", A("optimal", "Running counter with reset", "Your counter logic is right, but a streak that runs to the end is never recorded.", [neg("p.running_streak", "implement", "p.streak.update_only_on_break", "best updated inside else only")], "p.streak.update_only_on_break")],
  [15, "max-consecutive-ones", "485. Max Consecutive Ones", "submit", "Accepted", A("optimal", "Running counter with reset", "Correct streak tracking.", [pos("p.running_streak", "implement", "best updated each increment"), pos("p.running_streak", "trace", "handles trailing streak")])],
  [13, "rotate-array", "189. Rotate Array", "submit", "Runtime Error", A("optimal", "Three reversals: [0,k), [k,n), whole", "You know the reversal trick; k larger than the array size breaks it.", [neg("u.modular_arithmetic", "implement", "u.mod.k_not_reduced", "reverse(nums.begin(), nums.begin()+k) with k > n"), pos("p.reversal_trick", "recognize", "three reversals")], "u.mod.k_not_reduced")],
  [13, "rotate-array", "189. Rotate Array", "submit", "Wrong Answer", A("optimal", "Three reversals: [0,k), [k,n), whole", "k is reduced now; the reversal ranges rotate the wrong way.", [neg("p.reversal_trick", "implement", "p.rev.direction_mixup", "reverse first k then rest for a right rotation"), pos("u.modular_arithmetic", "implement", "k %= n")], "p.rev.direction_mixup")],
  [13, "rotate-array", "189. Rotate Array", "submit", "Accepted", A("optimal", "Three reversals: [0,k), [k,n), whole", "Correct ranges for a right rotation.", [pos("p.reversal_trick", "implement", "whole, then [0,k), then [k,n)"), pos("u.modular_arithmetic", "implement", "k %= n")])],
  [12, "missing-number", "268. Missing Number", "submit", "Accepted", A("optimal", "XOR of range and array", "XOR cancellation, first try.", [pos("p.xor_tricks", "implement", "xor indices and values"), pos("p.xor_tricks", "recognize", "odd one out"), pos("p.math_identities", "recognize", "considered sum formula")])],
  [10, "majority-element", "169. Majority Element", "submit", "Accepted", A("better", "Hashmap frequency count", "Correct, but uses O(n) space where an O(1) technique exists.", [pos("p.frequency_counting", "implement", "unordered_map counts"), neg("ds.hashmap", "recognize", "ds.hm.overuse", "hashmap for guaranteed majority", 0.7), neg("p.boyer_moore", "explain", "p.bm.mechanical", "did not use voting", 0.5)])],
  [9, "sort-colors", "75. Sort Colors", "submit", "Wrong Answer", A("optimal", "Dutch National Flag", "Three pointers set up correctly; one branch moves past an element it has not looked at.", [neg("p.dutch_national_flag", "implement", "p.dnf.mid_after_high_swap", "swap(nums[mid], nums[high]); high--; mid++;"), pos("p.dutch_national_flag", "recognize", "one-pass partition")], "p.dnf.mid_after_high_swap")],
  [9, "sort-colors", "75. Sort Colors", "submit", "Wrong Answer", A("optimal", "Dutch National Flag", "Still skipping an unclassified element in the 2-branch, and the loop stops one step early.", [neg("p.dutch_national_flag", "implement", "p.dnf.mid_after_high_swap", "mid++ after high swap"), neg("p.dutch_national_flag", "implement", "p.dnf.loop_condition", "while (mid < high)"), neg("r.invariants", "explain", "r.inv.cannot_state", "comment says 'mid scans everything'", 0.6)], "p.dnf.mid_after_high_swap")],
  [9, "sort-colors", "75. Sort Colors", "submit", "Accepted", A("optimal", "Dutch National Flag", "Correct one-pass DNF.", [pos("p.dutch_national_flag", "implement", "mid stays after high swap"), pos("p.dutch_national_flag", "trace", "mid <= high")])],
  [7, "maximum-subarray", "53. Maximum Subarray", "submit", "Wrong Answer", A("optimal", "Kadane", "Right algorithm; the starting value of your best tracker fails for one kind of input.", [neg("p.kadane", "implement", "p.kadane.all_negative", "int best = 0;"), neg("u.variable_init", "implement", "u.init.max_zero", "best = 0", 0.8), pos("p.kadane", "recognize", "single pass")], "u.init.max_zero")],
  [7, "maximum-subarray", "53. Maximum Subarray", "submit", "Accepted", A("optimal", "Kadane", "Kadane with correct init.", [pos("p.kadane", "implement", "best = INT_MIN, update before reset"), pos("u.variable_init", "implement", "INT_MIN sentinel", 0.7)])],
  [6, "3sum", "15. 3Sum", "submit", "Time Limit Exceeded", A("brute", "Three loops + set of sorted triplets", "Correct idea for small inputs; the constraints need a different shape.", [neg("r.complexity_analysis", "recognize", "r.cx.constraint_blind", "O(n^3) for n = 3000"), neg("p.skip_duplicates", "recognize", "p.dup.set_of_vectors", "set<vector<int>>", 0.7)], "r.cx.constraint_blind")],
  [6, "3sum", "15. 3Sum", "submit", "Wrong Answer", A("optimal", "Sort, fix i, converging pointers, skip duplicates", "Now sorting + two pointers. Duplicates still leak through at one level.", [neg("p.skip_duplicates", "implement", "p.dup.skip_wrong_level", "only i is de-duplicated"), pos("p.two_pointers_opposite", "implement", "lo/hi moves correct"), pos("p.sort_then_scan", "recognize", "sort first")], "p.dup.skip_wrong_level")],
  [6, "3sum", "15. 3Sum", "submit", "Runtime Error", A("optimal", "Sort, fix i, converging pointers, skip duplicates", "The duplicate skipping reads past the end of the array.", [neg("p.skip_duplicates", "implement", "p.dup.skip_out_of_bounds", "while (nums[j] == nums[j+1]) j++;"), neg("u.indexing", "implement", "u.idx.out_of_bounds", "nums[j+1] unguarded", 0.7)], "u.idx.out_of_bounds")],
  [6, "3sum", "15. 3Sum", "submit", "Accepted", A("optimal", "Sort, fix i, converging pointers, skip duplicates", "Accepted after hints.", [pos("p.two_pointers_opposite", "adapt", "nested inside fixed i"), pos("p.skip_duplicates", "implement", "guards j < k", 0.6)])],
  [4, "rotate-image", "48. Rotate Image", "submit", "Wrong Answer", A("optimal", "Transpose (j > i), then reverse each row", "Transpose + reverse is the right plan; the transpose undoes itself.", [neg("p.matrix_transpose_rotate", "implement", "p.rot.double_transpose", "for (j = 0; j < n; j++) swap(m[i][j], m[j][i])"), pos("p.matrix_transpose_rotate", "recognize", "in place")], "p.rot.double_transpose")],
  [4, "rotate-image", "48. Rotate Image", "submit", "Accepted", A("optimal", "Transpose (j > i), then reverse each row", "Correct in-place rotation.", [pos("p.matrix_transpose_rotate", "implement", "j = i + 1"), pos("cpp.2d_vector", "implement", "reverse(row.begin(), row.end()) on auto&")])],
  [3, "set-matrix-zeroes", "73. Set Matrix Zeroes", "submit", "Wrong Answer", A("optimal", "First row/column as markers + col0 variable", "Markers in the first row/column — the order you clear things in erases them.", [neg("p.in_place_markers", "implement", "p.mark.order", "zeroes row 0 before inner pass"), pos("p.in_place_markers", "recognize", "uses first row/col")], "p.mark.order")],
  [3, "set-matrix-zeroes", "73. Set Matrix Zeroes", "submit", "Wrong Answer", A("optimal", "First row/column as markers + col0 variable", "Order fixed; one cell is doing two jobs.", [neg("p.in_place_markers", "implement", "p.mark.overlap_00", "matrix[0][0] used for row 0 and col 0"), neg("p.in_place_markers", "explain", "p.mark.overlap_00", "no separate col0 flag", 0.6)], "p.mark.overlap_00")],
  [2, "next-permutation", "31. Next Permutation", "run", "Time Limit Exceeded", A("optimal", "Breakpoint, swap with rightmost larger, reverse suffix", "Your backwards loop never terminates.", [neg("cpp.unsigned_size", "implement", "cpp.unsigned.reverse_loop", "for (auto i = nums.size() - 2; i >= 0; i--)")], "cpp.unsigned.reverse_loop")],
  [2, "next-permutation", "31. Next Permutation", "submit", "Wrong Answer", A("optimal", "Breakpoint, swap with rightmost larger, reverse suffix", "Breakpoint found correctly; the swap partner is not the right one.", [neg("p.next_permutation", "implement", "p.np.wrong_swap_target", "swaps with nums[i+1]"), pos("p.next_permutation", "explain", "finds breakpoint from right")], "p.np.wrong_swap_target")],
  [2, "next-permutation", "31. Next Permutation", "submit", "Accepted", A("optimal", "Breakpoint, swap with rightmost larger, reverse suffix", "Correct three-step algorithm.", [pos("p.next_permutation", "implement", "rightmost larger, reverse suffix"), pos("cpp.unsigned_size", "implement", "int i = n - 2")])],
  [1, "spiral-matrix", "54. Spiral Matrix", "submit", "Wrong Answer", A("optimal", "Four shrinking boundaries", "Boundaries are right; a single remaining row gets printed twice.", [neg("p.matrix_boundary_traversal", "implement", "p.spiral.missing_guard", "no top <= bottom check before bottom row"), pos("p.matrix_boundary_traversal", "recognize", "boundaries not visited[]")], "p.spiral.missing_guard")],
  [1, "spiral-matrix", "54. Spiral Matrix", "submit", "Accepted", A("optimal", "Four shrinking boundaries", "Guards added; correct.", [pos("p.matrix_boundary_traversal", "implement", "guards on 3rd/4th side")])],
  [0, "majority-element-ii", "229. Majority Element II", "submit", "Wrong Answer", A("optimal", "Extended Boyer-Moore (two candidates) + verification pass", "Two candidates tracked correctly, but you trust them without checking.", [neg("p.boyer_moore", "adapt", "p.bm.no_verify", "returns {c1, c2} directly"), neg("p.boyer_moore", "explain", "p.bm.mechanical", "cannot justify n/3 bound in comments", 0.5)], "p.bm.no_verify")],
];

const HINTS = [[6, "3sum", "15. 3Sum"], [6, "3sum", "15. 3Sum"], [3, "set-matrix-zeroes", "73. Set Matrix Zeroes"]];

const STATUS = { Accepted: 10, "Wrong Answer": 11, "Time Limit Exceeded": 14, "Runtime Error": 15 };

setLlm(async ({ prompt }) => {
  const m = prompt.match(/DEMO#(\d+)/);
  if (m) return scripted.get(Number(m[1]));
  throw new Error("demo seed: no scripted analysis"); // prompts fall back to templates
});

await connectDb();
const { userId, token } = await registerUser();
const now = Date.now();

for (const [daysAgo, slug, title] of [...new Set(STORY.map(([d, s, t]) => `${d}|${s}|${t}`))].map((k) => k.split("|"))) {
  await ingestEvent(userId, { type: "open", slug, title }, { at: new Date(now - Number(daysAgo) * DAY - 3 * 3600e3) });
}
for (const [daysAgo, slug, title] of HINTS) {
  await ingestEvent(userId, { type: "hint", slug, title, prompt: "nudge me" }, { at: new Date(now - daysAgo * DAY - 3000e3) });
}

let i = 0;
for (const [daysAgo, slug, title, kind, verdict, analysis] of STORY) {
  const id = ++seq;
  scripted.set(id, analysis);
  const at = new Date(now - daysAgo * DAY - 2 * 3600e3 + i++ * 600e3);
  const result = kind === "run"
    ? { status_code: verdict === "Accepted" || verdict === "Wrong Answer" ? 10 : STATUS[verdict], status_msg: verdict, run_success: verdict === "Accepted" || verdict === "Wrong Answer", correct_answer: verdict === "Accepted", compare_result: verdict === "Wrong Answer" ? "10" : "11", code_answer: ["1", "0"], expected_code_answer: ["1", "2"] }
    : { status_code: STATUS[verdict], status_msg: verdict, total_correct: verdict === "Accepted" ? 100 : 87, total_testcases: 100, status_runtime: verdict === "Accepted" ? "0 ms" : "N/A", runtime_percentile: verdict === "Accepted" ? 92.4 : null, last_testcase: verdict === "Accepted" ? "" : "[-2,-1]", expected_output: verdict === "Wrong Answer" ? "-1" : "", code_output: verdict === "Wrong Answer" ? "0" : "" };
  await ingestEvent(
    userId,
    { type: kind, slug, title, lang: "cpp", code: `// DEMO#${id} (demo data — code omitted)\nclass Solution {\n  // ...\n};`, result },
    { userKey: "demo", wait: true, at }
  );
}

console.log(`\nDemo learner created (${STORY.length} attempts).`);
console.log(`Open: ${config.dashboardUrl}/#/?token=${token}\n`);
await closeDb();
