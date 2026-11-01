# AlgoSensei Knowledge Graph (C++)

The fixed **domain model** AlgoSensei grades against. Every run/submit is mapped onto this graph, so a learner's profile can be built from their very first problem. No historical data is required.

```
nodes/        concept DAG: one file per layer for shared concepts, plus L3_<topic>.json for each topic's patterns
problems/     one problem set per Striver A2Z topic, tagged against the nodes
tools/        validate.js, context-pack.js
graph.mmd     generated Mermaid view of the prerequisite DAG
```

```bash
npm run validate        # integrity checks + coverage stats (exit 1 on errors)
npm run graph           # validate + regenerate graph.mmd
npm run list            # list problem ids, topic by topic
npm run format -- <files>   # rewrite JSON in the house style (one-line tags and misconceptions)
npm run pack -- arr.two_sum   # the exact context the grading LLM receives for one problem
```

No dependencies; requires Node 18+.

---

## 1. Layers

| Layer | Prefix | What it captures | Examples |
|---|---|---|---|
| L0 Universal | `u.` | Language-agnostic mechanics | initialization, indexing, loop bounds, swapping, recursion |
| L1 C++ | `cpp.` | Language & STL specifics | `vector`, overflow / `long long`, `size_t`, iterators, `unordered_map` |
| L2 Data structures | `ds.` | Purpose, guarantees, costs, when to use | array, hashmap, string, linked list, stack, queue, heap, binary tree, BST, graph, union-find |
| L3 Patterns | `p.` | Reusable techniques with an invariant | two pointers, binary search on the answer, sliding window, fast/slow pointers, backtracking, monotonic stack, Dijkstra, knapsack DP |
| L4 Reasoning | `r.` | Meta-skills across all problems | problem modeling, edge cases, tracing, invariants, complexity |

A node's prerequisites must sit in the same or a lower layer (enforced by the validator). The graph is a **DAG**, not a tree, because a node can have several parents (e.g. `p.complement_lookup` needs both `ds.hashmap` and `p.linear_scan`).

Syntax is deliberately its own layer. "Understands what a hashmap is for" (`ds.hashmap`) and "knows `mp[key]` inserts a default" (`cpp.hash_containers`) are different gaps with different fixes.

## 2. Facets: what "understanding" a node means

Every node is graded on a subset of five fixed facets. Each node defines, per facet, what mastery looks like in concrete terms.

| Facet | Question it answers | Bloom's level | Typical review card |
|---|---|---|---|
| `recognize` | Do they know *when* to reach for it? | Analyze | "Which technique fits this statement, and why?" |
| `explain` | Do they know *why* it works and what it costs? | Understand | "Why doesn't `mid` advance after swapping with `high`?" |
| `implement` | Can they write it correctly in C++? | Apply | Fill in / fix a snippet |
| `trace` | Can they follow its state through a run? | Apply/Analyze | "What are low/mid/high after step 4?" |
| `adapt` | Can they handle variants and edge cases? | Evaluate/Create | A variant problem |

So a learner's state is a matrix of **(node × facet)** scores, which is the "reflection of their knowledge".

## 3. Misconceptions: the grading vocabulary

Each node lists its known failure modes:

```json
{ "id": "p.dnf.mid_after_high_swap", "facet": "implement",
  "desc": "Advanced mid after swapping with high, skipping an unclassified element.",
  "signals": ["optional observable cues: code shapes, verdicts"] }
```

The analysis LLM may **only** return misconception ids from the pack it receives. That turns open-ended grading into classification, so results are consistent, cheap, and comparable across problems and users. When a real mistake doesn't fit any id, add a new misconception here.

Ids are prefixed by their node's short prefix (`p.dnf.*` belongs to `p.dutch_national_flag`).

## 4. Problems

One file per topic, following Striver's A2Z sheet in its own order. Each file carries `topic`, `topic_title`, `step` (the A2Z step number, which orders topics) and its `sections`; problems are numbered from 1 within their topic.

| Step | Topic | File | Problems | LeetCode-linked |
|---|---|---|---|---|
| 3 | Arrays | `problems/arrays.json` | 32 | 23 |
| 4 | Binary search | `problems/binary_search.json` | 32 | 20 |
| 5 | Strings | `problems/strings.json` | 15 | 14 |
| 6 | Linked list | `problems/linked_list.json` | 30 | 15 |
| 7 | Recursion | `problems/recursion.json` | 24 | 15 |
| 9 | Stack and queue | `problems/stack_queue.json` | 29 | 18 |
| 13 | Binary trees | `problems/binary_trees.json` | 30 | 23 |
| 14 | Binary search trees | `problems/bst.json` | 14 | 12 |
| 15 | Graphs | `problems/graphs.json` | 44 | 28 |
| 16 | Dynamic programming | `problems/dp.json` | 55 | 38 |

Pure theory entries on the sheet (for example "Introduction to Trees" or "Graph Representation | Java") are left out. Where two sheet entries are the same LeetCode problem, only the first carries the link, so attempts are credited once; the other notes which problem to practise on. Every LeetCode slug was checked against LeetCode's problem list.

L2 and L3 nodes carry a `topic` (a problem-set topic, or `general` for structures used across topics such as the heap); the dashboard groups concepts by it.

```json
{ "id": "arr.sort_012", "tier": "Core",
  "approaches": [ { "level": "optimal", "name": "Dutch National Flag", "time": "O(n)", "space": "O(1)",
                    "demonstrates": ["p.dutch_national_flag", "r.invariants"] } ],
  "nodes": [ { "id": "p.dutch_national_flag", "role": "core", "facets": ["explain", "implement", "trace"] },
             { "id": "u.swap", "role": "supporting", "facets": ["implement"] } ],
  "watch_for": ["p.dnf.mid_after_high_swap", "p.dnf.loop_condition"] }
```

- **core**: the problem exists to test this node. Evidence counts fully.
- **supporting**: needed but incidental. Evidence counts partially.
- **approaches[].demonstrates**: credit depends on which approach the user actually wrote. A hashmap solution to Majority Element proves nothing about Boyer-Moore.
- **watch_for**: likely misconceptions, flagged `likely: true` in the pack. The grader can still choose any id in the pack.

## 5. How grading uses the graph

```
run/submit ──► context-pack(problem) + code + verdict + failing test + hints used
           ──► LLM returns findings[] (node, facet, polarity, misconception, evidence, confidence)
           ──► mastery update per (node, facet)
           ──► frontier ──► next move   |   learned facets ──► FSRS cards
```

**Root-cause attribution.** The pack includes the tested nodes' prerequisites. The grader is told to blame the *deepest* failing prerequisite: a wrong answer on 3Sum caused by `while (nums[j] == nums[j+1])` without a bounds guard is `p.dup.skip_out_of_bounds`, not "doesn't understand 3Sum". Many L0/L1 nodes are never `core` on a problem. That's intentional: they get graded through this attribution.

**Mastery (suggested start).** For each (node, facet) keep a Beta(α, β): positive evidence adds to α, negative to β, weighted by `confidence × (core ? 1.0 : 0.5)`. `α/(α+β)` is mastery and `α+β` is certainty. A clean, fast Accepted adds small positive evidence to the prerequisites of the core nodes too (upward inference). That's how one problem fills in much of a profile.

**Frontier / next move.** Pick the lowest-mastery (node, facet) whose prerequisites are all above threshold. That's the missing link. Remediate in this order: micro-drill isolating the facet → a problem where the node is `core` → confirm, then hand the facet to FSRS.

**FSRS.** One card per learned (node, facet). Solving a problem where the node is `core` counts as an implicit review, so nobody is asked to revise what they practised yesterday.

## 6. Extending

1. **New problem**: add it to a `problems/*.json` file. Tag 1–3 `core` nodes, list approaches with `demonstrates`, add `watch_for`. Run `npm run validate`.
2. **New concept**: add a node with prereqs, facet criteria and misconceptions. Shared data structures go in `L2_data_structures.json`, language details in `L1_cpp.json`, and a topic's patterns in `L3_<topic>.json`. Give L2 and L3 nodes a `topic`.
3. **New misconception** found in a real submission: add it to its node. Prefer this over free-text notes. Every id added makes the grader sharper.
4. **New topic** (for example the sheet's Greedy or Heaps step): add `problems/<topic>.json` with `topic`, `topic_title`, `step` and `sections`, plus `nodes/L3_<topic>.json` for its patterns. Run `npm run format` on new files and `npm run validate`.

The validator rejects unknown ids, facets a node doesn't define, prerequisite cycles, upward-layer prerequisites, problems without a core node, sections a problem set doesn't list, repeated positions within a topic and malformed LeetCode slugs. It warns when two problems share a LeetCode slug, and reports nodes and misconceptions that no problem exercises yet.
