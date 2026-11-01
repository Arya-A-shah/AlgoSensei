import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "../../api.js";
import { VerdictMark } from "./art.jsx";

export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}

// One shared copy of /me/overview: the HUD, the problem strip and the pages all read it.
const overview = { state: { data: null, error: null, loading: false }, listeners: new Set(), inflight: null };
const emit = () => overview.listeners.forEach((l) => l());
export function refreshOverview() {
  if (overview.inflight) return overview.inflight;
  overview.state = { ...overview.state, loading: true };
  emit();
  overview.inflight = api("/me/overview")
    .then((data) => { overview.state = { data, error: null, loading: false }; })
    .catch((error) => { overview.state = { data: overview.state.data, error, loading: false }; })
    .finally(() => { overview.inflight = null; emit(); });
  return overview.inflight;
}
export function useOverview() {
  const state = useSyncExternalStore(
    (l) => { overview.listeners.add(l); return () => overview.listeners.delete(l); },
    () => overview.state
  );
  useEffect(() => { if (!overview.state.data && !overview.inflight) refreshOverview(); }, []);
  return { ...state, reload: refreshOverview };
}

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const days = Math.round(s / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function timeUntil(d) {
  const s = Math.round((new Date(d) - Date.now()) / 1000);
  if (s <= 0) return "now";
  if (s < 3600) return `in ${Math.round(s / 60)}m`;
  if (s < 86400) return `in ${Math.round(s / 3600)}h`;
  const days = Math.round(s / 86400);
  return days === 1 ? "tomorrow" : `in ${days}d`;
}

export const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);
export const lcUrl = (slug) => (slug ? `https://leetcode.com/problems/${slug}/` : null);

export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="scroll-note scroll-error" role="alert">
      <p>{error.message}</p>
      {error.status === 401 && <p>Open the dashboard from the extension popup so the dojo knows who you are.</p>}
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Verdict({ verdict }) {
  const cls = verdict === "Accepted" ? "win" : verdict === "Compile Error" ? "ce" : "loss";
  return <span className={`verdict v-${cls}`}><VerdictMark verdict={verdict} />{verdict}</span>;
}

export function CodeBlock({ code }) {
  if (!code) return null;
  return <pre className="code"><code>{code}</code></pre>;
}

export function Bar({ value, status }) {
  return (
    <span className="bar" aria-hidden="true">
      <span className={`bar-fill bf-${status}`} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </span>
  );
}
