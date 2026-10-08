// API client. The token arrives once via the link in the extension popup (#/?token=...)
// and is kept in localStorage; the API URL and an optional Gemini key live in Settings.
const read = (k, d = "") => {
  try { return localStorage.getItem(k) ?? d; } catch { return d; }
};
const write = (k, v) => {
  try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {}
};

export const settings = {
  get apiUrl() { return read("dmm.apiUrl", import.meta.env.VITE_API_URL ?? "http://localhost:3001"); },
  set apiUrl(v) { write("dmm.apiUrl", v); },
  get token() { return read("dmm.token"); },
  set token(v) { write("dmm.token", v); },
  get geminiKey() { return read("dmm.geminiKey"); },
  set geminiKey(v) { write("dmm.geminiKey", v); },
};

// Pick up ?token= from the hash, store it, and clean the URL.
export function captureTokenFromUrl() {
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const t = params.get("token");
  if (t) {
    settings.token = t;
    params.delete("token");
    const rest = params.toString();
    history.replaceState(null, "", `#${path || "/"}${rest ? `?${rest}` : ""}`);
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${settings.apiUrl}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-User-Token": settings.token,
        ...(settings.geminiKey ? { "X-Gemini-Key": settings.geminiKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Can't reach the API at ${settings.apiUrl}. Start it with "npm run dev" in the api folder, or change the address in Settings.`, 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status);
  return json;
}
