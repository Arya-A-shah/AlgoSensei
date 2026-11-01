import { useEffect, useState } from "react";
import { LayoutDashboard, Radio, AlertTriangle } from "lucide-react";
import { getSession } from "./api";

const ago = (t) => {
  if (!t) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

// Capture status + entry point to the dashboard.
export default function MirrorBar() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  const stats = session?.stats ?? {};
  const offline = session && !session.token;

  return (
    <div className="mt-3 rounded-lg border border-line bg-washi p-3 text-xs text-ink space-y-2">
      <div className="flex items-center gap-2">
        {offline ? <AlertTriangle className="w-4 h-4 text-shaky" /> : <Radio className="w-4 h-4 text-matcha" />}
        <span className="font-medium">
          {offline
            ? "AlgoSensei server unreachable — attempts are queued"
            : `${stats.captured ?? 0} attempts captured${stats.lastAttempt ? ` · last: ${stats.lastAttempt.verdict ?? stats.lastAttempt.type} ${ago(stats.lastAttempt.at)}` : ""}`}
        </span>
      </div>
      {session?.queued > 0 && <p className="text-shaky">{session.queued} waiting to sync</p>}
      <button
        disabled={!session?.dashboardUrl}
        onClick={() => browser.tabs.create({ url: session.dashboardUrl })}
        className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-md bg-ai hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2"
      >
        <LayoutDashboard className="w-4 h-4" />
        Open dashboard
      </button>
    </div>
  );
}
