import { MongoClient } from "mongodb";
import { config } from "./config.js";

let client;
export let db;
export const col = {};

const COLLECTIONS = [
  "users",        // { _id: userId, tokenHash, createdAt }
  "attempts",     // one per run/submit, with analysis
  "progress",     // one per (user, slug): opens, runs, submits, hints, solved
  "mastery",      // one per (user, node, facet): Beta(alpha, beta) + evidence log
  "cards",        // one per (user, node, facet) once learned: FSRS state
  "reviewLogs",   // every FSRS review (manual or implicit)
  "problemTags",  // LLM auto-tags for problems that are not in a sheet yet
  "prompts",      // cached review / drill questions per (node, facet, kind)
  "events",       // raw open / hint events
];

export async function connectDb(uri = config.mongoUri, dbName = config.dbName) {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  for (const name of COLLECTIONS) col[name] = db.collection(name);

  await Promise.all([
    col.users.createIndex({ tokenHash: 1 }, { unique: true }),
    col.attempts.createIndex({ userId: 1, createdAt: -1 }),
    col.attempts.createIndex({ userId: 1, slug: 1, createdAt: -1 }),
    col.progress.createIndex({ userId: 1, slug: 1 }, { unique: true }),
    col.mastery.createIndex({ userId: 1, node: 1, facet: 1 }, { unique: true }),
    col.cards.createIndex({ userId: 1, node: 1, facet: 1 }, { unique: true }),
    col.cards.createIndex({ userId: 1, due: 1 }),
    col.reviewLogs.createIndex({ userId: 1, reviewedAt: -1 }),
    col.problemTags.createIndex({ slug: 1 }, { unique: true }),
    col.prompts.createIndex({ node: 1, facet: 1, kind: 1 }, { unique: true }),
    col.events.createIndex({ userId: 1, createdAt: -1 }),
  ]);
  return db;
}

export async function closeDb() {
  await client?.close();
}
