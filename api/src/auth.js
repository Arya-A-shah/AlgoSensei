// Minimal device-token auth: the extension registers once and keeps the token;
// the dashboard receives it via a link from the extension popup.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { col } from "./db.js";

const hash = (t) => createHash("sha256").update(t).digest("hex");

export async function registerUser() {
  const token = randomBytes(24).toString("base64url");
  const userId = randomUUID();
  await col.users.insertOne({ _id: userId, tokenHash: hash(token), createdAt: new Date() });
  return { userId, token };
}

export async function userFromToken(token) {
  if (!token) return null;
  return col.users.findOne({ tokenHash: hash(token) });
}

export const requireUser = async (c, next) => {
  const user = await userFromToken(c.req.header("X-User-Token"));
  if (!user) return c.json({ error: "Unknown or missing X-User-Token. Open the dashboard from the extension popup." }, 401);
  c.set("user", user);
  await next();
};
