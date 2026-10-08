// Runs in the PAGE's JavaScript world (not the extension sandbox) so it can observe
// LeetCode's own network calls and read the Monaco editor model.
//
// Flow LeetCode uses for both Run and Submit:
//   POST /problems/{slug}/interpret_solution/  -> { interpret_id }     (Run)
//   POST /problems/{slug}/submit/              -> { submission_id }    (Submit)
//   GET  /submissions/detail/{id}/check/       -> polled until state === "SUCCESS"
// We remember the request (code, lang, input) by id and emit one event when its
// result arrives. The isolated content script forwards it to the background worker.
export default defineContentScript({
  matches: ["*://leetcode.com/problems/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if (window.__dmmInstalled) return;
    window.__dmmInstalled = true;

    const START_RE = /^\/problems\/([^/]+)\/(submit|interpret_solution)\/?$/;
    const CHECK_RE = /^\/submissions\/detail\/([^/]+)\/check\/?$/;
    const pending = new Map(); // id -> { kind, slug, lang, code, dataInput, questionId, startedAt }

    const pathOf = (url) => {
      try { return new URL(url, location.origin).pathname; } catch { return ""; }
    };
    const parseBody = (body) => {
      if (!body || typeof body !== "string") return {};
      try { return JSON.parse(body); } catch { return {}; }
    };
    const emit = (type, payload) => window.postMessage({ source: "dmm-page", type, payload }, location.origin);

    function onResponse(url, reqBody, json) {
      if (!json || typeof json !== "object") return;
      const path = pathOf(url);

      const start = path.match(START_RE);
      if (start) {
        const id = json.submission_id ?? json.interpret_id;
        if (id == null) return;
        const body = parseBody(reqBody);
        pending.set(String(id), {
          kind: start[2] === "submit" ? "submit" : "run",
          slug: start[1],
          lang: body.lang ?? "cpp",
          code: body.typed_code ?? readEditor(),
          dataInput: body.data_input ?? "",
          questionId: body.question_id ?? null,
          startedAt: Date.now(),
        });
        return;
      }

      const check = path.match(CHECK_RE);
      if (check && json.state === "SUCCESS") {
        const req = pending.get(check[1]);
        if (!req) return;
        pending.delete(check[1]);
        emit("attempt", { ...req, result: json, finishedAt: Date.now() });
      }
    }

    const interesting = (url) => {
      const p = pathOf(url);
      return START_RE.test(p) || CHECK_RE.test(p);
    };

    // --- fetch ---
    const origFetch = window.fetch;
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : input?.url ?? String(input);
      const res = await origFetch.apply(this, arguments);
      if (interesting(url)) {
        const reqBody = init?.body ?? null;
        res.clone().json().then((j) => onResponse(url, reqBody, j)).catch(() => {});
      }
      return res;
    };

    // --- XMLHttpRequest ---
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__dmmUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (this.__dmmUrl && interesting(this.__dmmUrl)) {
        this.addEventListener("load", () => {
          try { onResponse(this.__dmmUrl, body, JSON.parse(this.responseText)); } catch {}
        });
      }
      return origSend.apply(this, arguments);
    };

    // --- full editor contents (the DOM only renders visible lines) ---
    function readEditor() {
      try {
        const models = window.monaco?.editor?.getModels?.() ?? [];
        const model = models.find((m) => m.getLanguageId?.() !== "plaintext") ?? models[0];
        return model?.getValue?.() ?? "";
      } catch {
        return "";
      }
    }

    window.addEventListener("message", (e) => {
      if (e.source !== window || e.data?.source !== "dmm-ext" || e.data.type !== "getCode") return;
      window.postMessage({ source: "dmm-page", type: "code", requestId: e.data.requestId, payload: { code: readEditor() } }, location.origin);
    });
  },
});
