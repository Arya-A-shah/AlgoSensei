import "dotenv/config";

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3001),
  mongoUri: env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
  dbName: env.MONGODB_DB ?? "dsa_mind_mirror",
  // Server-side Gemini key. Optional: the extension sends the user's own key per event,
  // and that takes precedence. Without either, attempts are stored but not analysed.
  geminiKey: env.GEMINI_API_KEY ?? "",
  geminiModel: env.GEMINI_MODEL ?? "gemini-flash-latest",
  // Which runs get LLM analysis: "all" | "failed" | "none". Submits are always analysed.
  analyzeRuns: env.ANALYZE_RUNS ?? "all",
  dashboardUrl: env.DASHBOARD_URL ?? "http://localhost:5173",
};
