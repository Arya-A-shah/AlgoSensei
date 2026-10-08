// Background worker: owns the user's device token and ships events to the API.
// Events that fail to send (API down, offline) are queued and retried with the next one.
import { BASE_URL, DASHBOARD_URL } from "./popup/constants";

const QUEUE_LIMIT = 100;

async function getToken() {
  const { DMM_TOKEN } = await browser.storage.local.get("DMM_TOKEN");
  if (DMM_TOKEN) return DMM_TOKEN;
  const res = await fetch(`${BASE_URL}/api/register`, { method: "POST" });
  if (!res.ok) throw new Error(`register failed: ${res.status}`);
  const { token, userId } = await res.json();
  await browser.storage.local.set({ DMM_TOKEN: token, DMM_USER_ID: userId });
  return token;
}

async function post(event) {
  const token = await getToken();
  const { GEMINI_API_KEY } = await browser.storage.local.get("GEMINI_API_KEY");
  const res = await fetch(`${BASE_URL}/api/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Token": token,
      ...(GEMINI_API_KEY ? { "X-Gemini-Key": GEMINI_API_KEY } : {}),
    },
    body: JSON.stringify(event),
  });
  if (res.status === 401) {
    // Token unknown to this server (e.g. database reset): re-register next time.
    await browser.storage.local.remove("DMM_TOKEN");
    throw new Error("token rejected");
  }
  if (!res.ok) throw new Error(`events ${res.status}: ${await res.text()}`);
  return res.json();
}

async function bumpStats(patch) {
  const { DMM_STATS = {} } = await browser.storage.local.get("DMM_STATS");
  await browser.storage.local.set({ DMM_STATS: { ...DMM_STATS, ...patch(DMM_STATS) } });
}

async function deliver(event) {
  const { DMM_QUEUE = [] } = await browser.storage.local.get("DMM_QUEUE");
  const queue = [...DMM_QUEUE, { ...event, queuedAt: Date.now() }].slice(-QUEUE_LIMIT);
  const left = [];
  let lastResult = null;
  for (const ev of queue) {
    try {
      lastResult = await post(ev);
      if (ev.type === "run" || ev.type === "submit") {
        await bumpStats((s) => ({ captured: (s.captured ?? 0) + 1, lastAttempt: { slug: ev.slug, type: ev.type, verdict: lastResult.verdict, at: Date.now() }, lastError: null }));
      }
    } catch (e) {
      left.push(ev);
      await bumpStats(() => ({ lastError: e.message, lastErrorAt: Date.now() }));
    }
  }
  await browser.storage.local.set({ DMM_QUEUE: left });
  return lastResult;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "DMM_EVENT") {
      deliver(message.event).then(sendResponse, () => sendResponse(null));
      return true;
    }
    if (message.type === "DMM_SESSION") {
      (async () => {
        let token = null;
        let error = null;
        try { token = await getToken(); } catch (e) { error = e.message; }
        const { DMM_STATS = {}, DMM_QUEUE = [] } = await browser.storage.local.get(["DMM_STATS", "DMM_QUEUE"]);
        sendResponse({ token, error, stats: DMM_STATS, queued: DMM_QUEUE.length, dashboardUrl: token ? `${DASHBOARD_URL}/#/?token=${encodeURIComponent(token)}` : null });
      })();
      return true;
    }
  });
});
