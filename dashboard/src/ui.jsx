import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

export const FACETS = ["recognize", "explain", "implement", "trace", "adapt"];
export const FACET_LABEL = { recognize: "Recognize", explain: "Explain", implement: "Implement", trace: "Trace", adapt: "Adapt" };
export const STATUS_LABEL = { weak: "Weak", shaky: "Shaky", solid: "Solid", unknown: "Not seen yet" };

export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const days = Math.round(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function timeUntil(d) {
  const s = Math.round((new Date(d) - Date.now()) / 1000);
  if (s <= 0) return "now";
  if (s < 3600) return `in ${Math.round(s / 60)} min`;
  if (s < 86400) return `in ${Math.round(s / 3600)} h`;
  const days = Math.round(s / 86400);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);

// Five cells, one per facet; undefined facets are not drawn.
export function FacetStrip({ facets, size = "sm" }) {
  return (
    <span className={`strip strip-${size}`} role="img" aria-label={FACETS.filter((f) => facets[f]).map((f) => `${FACET_LABEL[f]}: ${STATUS_LABEL[facets[f].status]}`).join(", ")}>
      {FACETS.map((f) =>
        facets[f] ? <span key={f} className={`cell st-${facets[f].status}`} title={`${FACET_LABEL[f]} · ${STATUS_LABEL[facets[f].status]}${facets[f].mastery != null ? ` (${pct(facets[f].mastery)})` : ""}`} /> : <span key={f} className="cell cell-none" />
      )}
    </span>
  );
}

// Belt = how many of the 5 facets (recognize, explain, implement, trace, adapt) are solid.
// White belt once a concept has been seen at all; black belt when all five are solid.
export const BELTS = [
  { name: "White", color: "#f4f4f2" },
  { name: "Yellow", color: "#f2c94c" },
  { name: "Orange", color: "#f2994a" },
  { name: "Green", color: "#3fa463" },
  { name: "Brown", color: "#8b5a2b" },
  { name: "Black", color: "#1d1d1f" },
];

export function beltFor(facets) {
  const seen = FACETS.filter((f) => facets[f] && facets[f].status !== "unknown");
  if (seen.length === 0) return null;
  const solid = FACETS.filter((f) => facets[f]?.status === "solid").length;
  return { level: solid, ...BELTS[solid] };
}

export function Belt({ facets, withLabel = false }) {
  const b = beltFor(facets);
  if (!b) return null;
  const label = `${b.name} belt: ${b.level} of 5 facets solid`;
  return (
    <span className="belt" title={label} aria-label={label} role="img">
      <span className="belt-band" style={{ background: b.color }} />
      {withLabel && <span className="belt-name">{b.name} belt</span>}
    </span>
  );
}

export function StatusTag({ status }) {
  return <span className={`tag st-text-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Verdict({ verdict }) {
  const cls = verdict === "Accepted" ? "ok" : verdict === "Compile Error" ? "ce" : "bad";
  return <span className={`verdict v-${cls}`}>{verdict}</span>;
}

export function Meter({ value, status }) {
  return (
    <span className="meter" aria-hidden="true">
      <span className={`meter-fill st-${status}`} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </span>
  );
}

export function Loading() {
  return <p className="quiet pad">Loading…</p>;
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="note note-error" role="alert">
      <p>{error.message}</p>
      {error.status === 401 && <p>Open the dashboard from the extension popup (“Open dashboard”) so it knows who you are.</p>}
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export const lcUrl = (slug) => (slug ? `https://leetcode.com/problems/${slug}/` : null);

export function CodeBlock({ code }) {
  if (!code) return null;
  return <pre className="code"><code>{code}</code></pre>;
}
