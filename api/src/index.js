import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { api } from "./routes.js";
import { userFromToken } from "./auth.js";
import { ingestEvent } from "./pipeline.js";

export const app = new Hono();

app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "X-User-Token", "X-Gemini-Key"] }));

app.get("/", (c) => c.text("AlgoSensei API"));
app.get("/health", (c) => c.json({ ok: true }));

app.route("/api", api);

// ---------- hint endpoints (used by the extension) ----------

app.post("/hint", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid API key" }, 401);
  }

  const apiKey = authHeader.split(" ")[1];
  const { code, prompt, title, description, slug } = await c.req.json();

  // Hints now count toward progress (they lower the "clean solve" credit).
  const user = await userFromToken(c.req.header("X-User-Token"));
  if (user && slug) ingestEvent(user._id, { type: "hint", slug, title, prompt }).catch(() => {});

  try {
    const ai = new GoogleGenAI({ apiKey });

    const fullPrompt = `
You are a Socratic LeetCode mentor who guides users to discover solutions through thoughtful questioning and gentle nudges. Your role is to help users think critically and reach insights on their own.

 CONTEXT:
Problem: ${title}
Description: ${description}
User's Code: ${code}
User's Question: ${prompt}

 YOUR SOCRATIC APPROACH:
Instead of telling users what's wrong, guide them to discover it themselves through strategic questions and observations.

 SOCRATIC GUIDELINES:

✅ DO - Use These Techniques:
-  Ask leading questions  that point toward the issue without revealing it
-  Prompt reflection  on their approach: "What happens when...?" "Have you considered...?"
-  Guide observation : "Take a closer look at line X. What do you notice about...?"
-  Encourage testing : "What would happen if you traced through this input...?"
-  Connect to fundamentals : "What does this data structure guarantee about...?"
-  Use analogies : "Think of this like... How would you handle..."
-  Point to contradictions : "You mentioned X, but your code does Y. Why might that be?"

❌ DON'T - Avoid These Patterns:
- Direct statements like "Your loop is wrong" or "You need to handle edge case X"
- Giving away the solution or specific fix
- Multiple unrelated questions that overwhelm
- Technical jargon without context

 RESPONSE STRUCTURE:
  Think About This : [1-2 probing questions that lead to the core issue]
  Let's Investigate : [Specific observation or experiment to try]
  Consider : [Gentle nudge toward the right direction through analogy or principle]

 TONE:
Curious, encouraging, and patient. Like a wise teacher who knows the answer but wants the student to experience the joy of discovery. Use "you" language to make it personal and engaging.

---

Generate your Socratic response now:`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: fullPrompt,
    });

    return c.json({ hint: response.text });
  } catch (error) {
    console.error("Gemini error:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/resources", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid API key" }, 401);
  }

  const apiKey = authHeader.split(" ")[1];
  const { title, description } = await c.req.json();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: `For the LeetCode problem "${title}", ${description}, list the relevant Data Structures and Algorithms topics that can be used to solve the problem.`,
    });
    if (!response?.text) return c.json({ error: "Invalid response format" }, 500);
    return c.json({ prerequisites: response.text });
  } catch (error) {
    console.error("Gemini error:", error);
    return c.json({ error: "Failed to generate content: " + error.message }, 500);
  }
});

// Start only when run directly (tests import `app` without listening).
if (import.meta.url === `file://${process.argv[1]}`) {
  await connectDb();
  serve({ fetch: app.fetch, port: config.port });
  console.log(`AlgoSensei API on http://localhost:${config.port}  (db: ${config.dbName})`);
}
