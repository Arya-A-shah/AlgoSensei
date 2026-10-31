# AlgoSensei

Your DSA sensei: a learning system around LeetCode. The extension gives Socratic hints on a three-step ladder (**Nudge → Concept → Pinpoint**) that nudge you toward the answer without spoiling it. On top of that, every **Run** and **Submit** is captured, graded against a fixed C++ knowledge graph, and turned into a picture of what you actually understand.

The dashboard plays like a martial-arts game. Problems sit as numbered tiles across the top; click one for its detail.

- **Sensei**: tells you the single highest-value move right now (train a weak skill, spar, finish a fight, or take the next one), with a drill when you need it
- **Dojo**: every concept as a skill with a belt and five pips (spot / explain / code / trace / adapt). Data structures are weapons: array is the bo staff, hash map the shuriken
- **Arena**: FSRS spaced repetition as sparring rounds on skills you've already learned
- **Fight log**: every run and submit, what it showed, the hints before it, and how your skills moved

```
AlgoSensei/
  knowledge-graph/   concept DAG (59 nodes, 158 misconceptions) + Striver arrays tagging (32 problems)
  api/               Hono + MongoDB: events, Gemini grading, mastery model, FSRS, next-move engine
  extension/         WXT Chrome extension: Socratic hints + attempt capture
  dashboard/         Vite + React dashboard (sensei, dojo, arena, fight log)
```

## Run it locally

You need Node 20+ and a MongoDB instance.

```bash
# 1. MongoDB (or use a MongoDB Atlas URI in api/.env)
docker compose up -d

# 2. API  → http://localhost:3001
cd api
cp .env.example .env        # optionally add GEMINI_API_KEY
npm install
npm run dev

# 3. Dashboard  → http://localhost:5173
cd ../dashboard
npm install
npm run dev

# 4. Extension
cd ../extension
npm install
npm run build               # or `npm run dev` for hot reload
```

Load the extension in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → `extension/.output/chrome-mv3`. Save your Gemini key in the popup, solve something on LeetCode, then click **Open dashboard** in the popup. That link carries your device token, so the dashboard knows who you are.

**Just want to look?** `cd api && npm run seed` creates a demo learner with three weeks of history and prints a dashboard link.

## How an attempt flows

1. `extension/entrypoints/interceptor.content.js` runs in LeetCode's page context and watches its own network calls: `POST /problems/{slug}/interpret_solution/` (Run), `POST /problems/{slug}/submit/` (Submit), then the `/submissions/detail/{id}/check/` poll. When the result arrives it emits one event with the exact code sent, the language, the input and the verdict. It also reads the full editor through Monaco. The old DOM scrape only saw the lines visible on screen.
2. `content.js` adds the title and description, and also reports problem opens (for time-on-problem). `background.js` posts the event to the API with your device token and Gemini key. If the API is down, events are queued and retried.
3. `api/src/pipeline.js` normalises the verdict (a Run that "Accepted" can still be a wrong answer), updates progress, stores the attempt and maps the problem to the graph. Sheet problems map by slug. Any other LeetCode problem is auto-tagged once by Gemini and cached.
4. `analysis.js` sends Gemini the problem's **context pack** (tested concepts, prerequisites, allowed misconception ids) plus the code and the verdict. The response is schema-constrained JSON, and any id not in the pack is dropped. Findings are attributed to the deepest prerequisite that explains them.
5. `mastery.js` turns findings and verdict signals into evidence on a Beta(α, β) for each (concept, facet). A clean Accepted credits the approach actually written, plus a little credit to its prerequisites.
6. `reviews.js` gives a facet an FSRS card once it reads solid. Later mistakes on that facet count as lapses, and solving a problem that uses it counts as a review.
7. `recommend.js` ranks next moves. A weak prerequisite only takes over a gap when both were flagged in the same attempt, so one stray bug doesn't hide everything built on top of it.

## How a hint works

The popup offers three rungs. Each one gives away more, and the deepest rung you used on a problem lowers the mastery credit a later solve earns (`HINT_FACTOR` in `mastery.js`: 0.9 / 0.75 / 0.6).

| Level | Name | What it does |
|---|---|---|
| 1 | Nudge | 1–2 questions about where to look. Never names a technique or concept. |
| 2 | Concept | Names the concept or invariant at stake and asks you to check your code against it. |
| 3 | Pinpoint | Points at the exact variable, condition or bound and ties it to the failing case. Still no fix. |

`POST /api/hints` (`api/src/hints.js`) grounds every hint in:

- the problem's **context pack**, the same concepts and misconception ids the grader uses;
- your **last run or submit** on this problem: verdict, failing input, expected vs. actual output, and the grader's root cause (never quoted to you), plus whether your code changed since;
- your **weak or shaky facets** among this problem's concepts;
- the **hints already given** here, so the next one goes a step further instead of repeating.

The response is schema-constrained JSON. Ids outside the pack are dropped, a level-1 hint never reveals its concept, and a spoiler guard removes solution-sized code. Each hint is stored with its level and focus concept, and the Fight log shows the hints that led to each attempt. The old `POST /hint` route still works and serves the same ladder.

## Configuration (`api/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Any MongoDB (local, Docker, Atlas) |
| `MONGODB_DB` | `dsa_mind_mirror` | Database name |
| `GEMINI_API_KEY` | – | Server-side fallback key. The extension's key, when sent, takes precedence |
| `GEMINI_MODEL` | `gemini-flash-latest` | Model for grading, tagging and card generation |
| `ANALYZE_RUNS` | `all` | `all`, `failed` or `none`. Submits are always analysed |
| `PORT` | `3001` | API port |

Change `extension/entrypoints/popup/constants.js` (and `host_permissions` in `wxt.config.js`) when you deploy the API or dashboard elsewhere.

## Tests

```bash
cd api && npm run test:unit     # hint ladder + solve credit, no database needed
cd api && npm test               # everything; needs a MongoDB at MONGODB_URI (throwaway database)
cd knowledge-graph && npm run validate
```

## Known limits

- Only LeetCode is captured. Sheet problems without a LeetCode version (Linear Search, Leaders, Union of sorted arrays…) show as untracked until takeuforward / GFG capture is added.
- Auth is a per-browser device token, which is fine for personal use. Add real accounts before sharing a server.
- Interception depends on LeetCode's current endpoints. If they change, `interceptor.content.js` is the single place to update.
- Mastery weights and thresholds are sensible defaults (`mastery.js`, `recommend.js`), not yet tuned on real data.
