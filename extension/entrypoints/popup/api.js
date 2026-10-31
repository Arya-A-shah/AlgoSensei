import { BASE_URL } from "./constants";

/**
 * Asks the API for one rung of the hint ladder (1 Nudge, 2 Concept, 3 Pinpoint).
 * With a device token it uses /api/hints, which grounds the hint in your last attempt
 * and your mastery; without one it falls back to the legacy /hint route.
 * Returns { hint, level, levelName, focusName, nextLevel, grounded, usedLastAttempt } or { error }.
 */
export async function getHint({ code, question, title, description, slug, level, apiKey, userToken }) {
  const body = JSON.stringify({ code, question, title, description, slug, level });
  try {
    const res = userToken
      ? await fetch(`${BASE_URL}/api/hints`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Token": userToken, "X-Gemini-Key": apiKey },
          body,
        })
      : await fetch(`${BASE_URL}/hint`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
        });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? `Server error ${res.status}` };
    return data;
  } catch {
    return { error: `Can't reach the AlgoSensei server at ${BASE_URL}. Is it running?` };
  }
}

export function getSession() {
  return browser.runtime.sendMessage({ type: "DMM_SESSION" }).catch(() => null);
}

// The popup closes whenever you click back into the page, so the ladder for each
// problem is kept in storage and restored when it reopens.
const LADDER_KEY = "DMM_LADDERS";
const LADDER_TTL = 3 * 864e5;

export async function loadLadder(slug) {
  if (!slug) return null;
  const { [LADDER_KEY]: all = {} } = await browser.storage.local.get(LADDER_KEY);
  const l = all[slug];
  return l && Date.now() - l.updatedAt < LADDER_TTL ? l : null;
}

export async function saveLadder(slug, ladder) {
  if (!slug) return;
  const { [LADDER_KEY]: all = {} } = await browser.storage.local.get(LADDER_KEY);
  const fresh = Object.fromEntries(Object.entries(all).filter(([, v]) => Date.now() - v.updatedAt < LADDER_TTL));
  fresh[slug] = { ...ladder, updatedAt: Date.now() };
  await browser.storage.local.set({ [LADDER_KEY]: fresh });
}
