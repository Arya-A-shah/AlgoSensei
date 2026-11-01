import { useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, ChevronDown, ChevronUp, Compass, Lightbulb, Crosshair, RotateCcw, Target, MessageSquare } from "lucide-react";
import { Sensei } from "./Sensei";

// The ladder: each rung gives away more, so a later solve earns a little less credit.
const RUNGS = [
  { level: 1, name: "Nudge", icon: Compass, blurb: "Where to look", ring: "border-matcha text-matcha", fill: "bg-matcha hover:brightness-110", rod: "bg-matcha" },
  { level: 2, name: "Concept", icon: Lightbulb, blurb: "What's at stake", ring: "border-shaky text-shaky", fill: "bg-shaky hover:brightness-110", rod: "bg-shaky" },
  { level: 3, name: "Pinpoint", icon: Crosshair, blurb: "Exactly where", ring: "border-weak text-weak", fill: "bg-weak hover:brightness-110", rod: "bg-weak" },
];
const rungOf = (h) => RUNGS[Math.min(3, Math.max(1, h?.level ?? 1)) - 1];

// A hint as the sensei says it: his questions, what to look at, then the push.
// Hints saved before this layout only have text.
function HintWords({ hint, small = false }) {
  const lines = hint.questions?.length || hint.observation || hint.nudge
    ? [...(hint.questions ?? []), hint.observation, hint.nudge].filter(Boolean)
    : [hint.text];
  return (
    <div className={small ? "space-y-1" : "space-y-2"}>
      {lines.map((l, i) => (
        <p key={i} className={`whitespace-pre-wrap ${small ? "text-[13px] leading-snug" : i === 0 ? "font-display text-[17px] leading-snug" : "text-sm leading-relaxed"}`}>
          {l}
        </p>
      ))}
    </div>
  );
}

// A small hanging scroll with a tail pointing back at the sensei.
function Speech({ children, tone = "bg-rod" }) {
  return (
    <div className="relative flex-1 min-w-0">
      <span aria-hidden="true" className="absolute -left-[6px] top-7 w-3 h-3 rotate-45 bg-paper border-l border-b border-line" />
      <div className={`h-2 rounded-full ${tone}`} aria-hidden="true" />
      <div className="relative mx-1 bg-paper border-x border-line px-3 py-3 text-ink">{children}</div>
      <div className={`h-2 rounded-full ${tone}`} aria-hidden="true" />
    </div>
  );
}

const HintScreen = ({ slug, ladder, loadingLevel, onAsk, onReset, setQuestion, apiKey, setApiKey, saveKey }) => {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [showAsk, setShowAsk] = useState(Boolean(ladder.question));
  const [showEarlier, setShowEarlier] = useState(false);
  const deepest = ladder.hints.reduce((m, h) => Math.max(m, h.level ?? 0), 0);
  const suggested = Math.min(3, deepest + 1);
  const busy = loadingLevel !== null;
  const latest = ladder.hints.at(-1);
  const earlier = ladder.hints.slice(0, -1).reverse();

  const handleApiKeySave = () => {
    if (apiKey.trim() === "") return toast.error("API key cannot be empty!");
    saveKey();
    setShowApiKeyInput(false);
    toast.success("API key saved");
  };

  return (
    <div className="w-full max-w-sm bg-panel text-ink rounded-lg">
      <div className="px-4 py-3 border-b border-line flex items-center gap-3">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="text-weak shrink-0">
          <path d="M1 14 L12 3 L23 14 Q12 17 1 14 Z" fill="currentColor" />
        </svg>
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-none font-semibold text-ink pt-1">AlgoSensei</h2>
          <p className="text-xs text-muted truncate">{slug ? slug.replace(/-/g, " ") : "Open a LeetCode problem"}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* The sensei speaks */}
        <section className="flex items-start gap-2" aria-live="polite" aria-label="Sensei">
          <div className="shrink-0 pt-1"><Sensei size={76} /></div>
          {busy ? (
            <Speech tone={rungOf({ level: loadingLevel }).rod}>
              <p className="font-display text-[17px] leading-snug flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted" /> Let me look at your code…
              </p>
            </Speech>
          ) : latest ? (
            <Speech tone={rungOf(latest).rod}>
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] mb-1.5">
                <span className={`font-semibold ${rungOf(latest).ring.split(" ")[1]}`}>{rungOf(latest).name}</span>
                {latest.focusName && <span className="inline-flex items-center gap-1 text-ink"><Target className="w-3 h-3" />{latest.focusName}</span>}
                {latest.usedLastAttempt && <span className="text-muted">from your last run</span>}
              </p>
              <HintWords hint={latest} />
            </Speech>
          ) : (
            <Speech>
              <p className="font-display text-[17px] leading-snug">{slug ? "Stuck? Ask me for a nudge first." : "Open a LeetCode problem and I'll help."}</p>
              {slug && <p className="text-sm text-muted mt-1.5">Each step gives away more, so use as little as you can.</p>}
            </Speech>
          )}
        </section>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Hint level">
            {RUNGS.map((r) => {
              const Icon = r.icon;
              const isNext = r.level === suggested;
              const used = r.level <= deepest;
              return (
                <button
                  key={r.level}
                  onClick={() => onAsk(r.level)}
                  disabled={busy || !slug}
                  title={r.level > suggested ? `Skip ahead to ${r.name}: gives away more` : r.blurb}
                  className={`cursor-pointer rounded-lg border px-2 py-2 text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    isNext ? `${r.fill} border-transparent text-white` : `bg-washi ${used ? r.ring : "border-line text-ink"} hover:bg-wash-2`
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-semibold text-sm">
                    {loadingLevel === r.level ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    {r.name}
                  </span>
                  <span className={`block text-[11px] ${isNext ? "text-white/85" : "text-muted"}`}>
                    {used && !isNext ? "Ask again" : r.blurb}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted">A solve after a pinpoint earns less mastery credit than one after a nudge.</p>
        </div>

        <div>
          <button className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-medium text-ai" onClick={() => setShowAsk((v) => !v)} aria-expanded={showAsk}>
            <MessageSquare className="w-4 h-4" /> {showAsk ? "Your question" : "Ask about something specific"}
          </button>
          {showAsk && (
            <textarea
              value={ladder.question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              aria-label="Your question for the sensei"
              className="mt-2 w-full rounded-lg bg-washi border border-line text-ink placeholder-muted/60 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ai"
              placeholder="e.g. My answer is wrong when all numbers are negative"
            />
          )}
        </div>

        {earlier.length > 0 && (
          <div className="space-y-2">
            <button className="cursor-pointer w-full flex items-center justify-between text-sm font-medium" onClick={() => setShowEarlier((v) => !v)} aria-expanded={showEarlier}>
              <span>Earlier hints ({earlier.length})</span>
              {showEarlier ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
            </button>
            {showEarlier && earlier.map((h, i) => (
              <div key={h.at ?? i} className={`border-l-4 ${rungOf(h).ring.split(" ")[0]} bg-paper rounded-r-md px-3 py-2`}>
                <p className={`text-[11px] font-semibold mb-1 ${rungOf(h).ring.split(" ")[1]}`}>{rungOf(h).name}{h.focusName ? ` on ${h.focusName}` : ""}</p>
                <HintWords hint={h} small />
              </div>
            ))}
          </div>
        )}
        {ladder.hints.length > 0 && (
          <button onClick={onReset} className="cursor-pointer inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <RotateCcw className="w-3 h-3" /> Clear hints for this problem
          </button>
        )}

        <div className="border border-line p-3 rounded-md bg-washi">
          <button
            className="cursor-pointer w-full flex justify-between items-center select-none"
            onClick={() => setShowApiKeyInput((prev) => !prev)}
            aria-expanded={showApiKeyInput}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <KeyRound className="w-4 h-4 text-ai" /> Change API key
            </span>
            {showApiKeyInput ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
          </button>
          {showApiKeyInput && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md bg-panel border border-line text-ink placeholder-muted/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ai"
                placeholder="Your Gemini API key"
              />
              <button onClick={handleApiKeySave} className="cursor-pointer w-full text-sm font-semibold py-2 rounded-md bg-ai text-white hover:brightness-110 transition">
                Save API key
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HintScreen;
