// Isolated-world content script: bridges the page interceptor to the background worker,
// reports problem opens, and answers the popup's request for the current code.
export default defineContentScript({
  matches: ["*://leetcode.com/problems/*"],
  main() {
    const slugFromPath = () => location.pathname.match(/^\/problems\/([^/]+)/)?.[1] ?? null;

    const readTitle = () => {
      const el = document.querySelector('a[href^="/problems/"].no-underline') ?? document.querySelector('[data-cy="question-title"]');
      return el?.innerText.trim() || document.title.replace(/ - LeetCode.*$/, "").trim() || slugFromPath();
    };
    const readDescription = () =>
      document.querySelector('[data-track-load="description_content"]')?.innerText.trim() ?? "";

    // Fallback for when the page bridge does not answer: only the rendered lines.
    const readCodeFromDom = () =>
      Array.from(document.querySelectorAll(".monaco-editor .view-lines > div") ?? []).map((l) => l.innerText).join("\n");

    const send = (event) => browser.runtime.sendMessage({ type: "DMM_EVENT", event }).catch(() => {});

    // ---- run / submit results from the page interceptor ----
    window.addEventListener("message", (e) => {
      if (e.source !== window || e.data?.source !== "dmm-page" || e.data.type !== "attempt") return;
      const p = e.data.payload;
      send({
        type: p.kind,
        slug: p.slug,
        title: readTitle(),
        description: readDescription().slice(0, 6000),
        lang: p.lang,
        code: p.code,
        dataInput: p.dataInput,
        result: p.result,
        clientElapsedMs: p.finishedAt - p.startedAt,
      });
    });

    // ---- problem opens (LeetCode is a single-page app: watch the URL) ----
    let lastSlug = null;
    const checkOpen = () => {
      const slug = slugFromPath();
      if (slug && slug !== lastSlug) {
        lastSlug = slug;
        // Give the SPA a moment to render the new title.
        setTimeout(() => send({ type: "open", slug, title: readTitle() }), 1500);
      }
    };
    checkOpen();
    setInterval(checkOpen, 1000);

    // ---- full code via the page bridge ----
    const getCode = () =>
      new Promise((resolve) => {
        const requestId = Math.random().toString(36).slice(2);
        const onMsg = (e) => {
          if (e.source === window && e.data?.source === "dmm-page" && e.data.type === "code" && e.data.requestId === requestId) {
            window.removeEventListener("message", onMsg);
            resolve(e.data.payload.code || readCodeFromDom());
          }
        };
        window.addEventListener("message", onMsg);
        window.postMessage({ source: "dmm-ext", type: "getCode", requestId }, location.origin);
        setTimeout(() => {
          window.removeEventListener("message", onMsg);
          resolve(readCodeFromDom());
        }, 600);
      });

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "GET_LEETCODE_CODE") {
        getCode()
          .then((code) => sendResponse({ code, title: readTitle(), description: readDescription(), slug: slugFromPath() }))
          .catch(() => sendResponse({ error: "Failed to scrape page data." }));
        return true; // async response
      }
    });
  },
});
