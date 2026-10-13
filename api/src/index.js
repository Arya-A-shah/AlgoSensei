import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { api, hintResponse } from "./routes.js";
import { userFromToken } from "./auth.js";

export const app = new Hono();

app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "X-User-Token", "X-Gemini-Key"] }));

app.get("/", (c) => c.text("AlgoSensei API"));
app.get("/health", (c) => c.json({ ok: true }));

app.route("/api", api);

// ---------- legacy hint endpoint ----------
// Older extension builds call POST /hint with the Gemini key as a Bearer token.
// It now serves the same graph-aware ladder as POST /api/hints (level defaults to 1).
app.post("/hint", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid API key" }, 401);
  }
  const apiKey = authHeader.slice("Bearer ".length).trim();
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid JSON" }, 400);
  const user = await userFromToken(c.req.header("X-User-Token"));
  const res = await hintResponse(user?._id ?? null, body, apiKey);
  return c.json(res.body, res.status);
});

// Start only when run directly (tests import `app` without listening).
if (import.meta.url === `file://${process.argv[1]}`) {
  await connectDb();
  serve({ fetch: app.fetch, port: config.port });
  console.log(`AlgoSensei API on http://localhost:${config.port}  (db: ${config.dbName})`);
}
