import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, KeyRound, ChevronDown, ChevronUp, Compass, Lightbulb, Crosshair, RotateCcw, Target } from "lucide-react";

// The ladder: each rung gives away more, so a later solve earns a little less credit.
const RUNGS = [
  { level: 1, name: "Nudge", icon: Compass, blurb: "Where to look", ring: "border-jade text-jade", fill: "bg-jade hover:brightness-110" },
  { level: 2, name: "Concept", icon: Lightbulb, blurb: "What's at stake", ring: "border-shaky text-shaky", fill: "bg-shaky hover:brightness-110" },
  { level: 3, name: "Pinpoint", icon: Crosshair, blurb: "Exactly where", ring: "border-blood text-blood", fill: "bg-blood hover:brightness-110" },
];

const HintScreen = ({ slug, ladder, loadingLevel, onAsk, onReset, setQuestion, apiKey, setApiKey, saveKey }) => {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const deepest = ladder.hints.reduce((m, h) => Math.max(m, h.level ?? 0), 0);
  const suggested = Math.min(3, deepest + 1);
  const busy = loadingLevel !== null;

  const handleApiKeySave = () => {
    if (apiKey.trim() === "") return toast.error("API key cannot be empty!");
    saveKey();
    setShowApiKeyInput(false);
    toast.success("API key saved");
  };

  return (
    <div className="w-full max-w-sm bg-lacquer text-bone rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-line flex items-center gap-3">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="text-ember shrink-0">
          <path d="M1 14 L12 3 L23 14 Q12 17 1 14 Z" fill="currentColor" />
        </svg>
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-none font-semibold text-bone pt-1">AlgoSensei</h2>
          <p className="text-xs text-dust truncate">{slug ? slug.replace(/-/g, " ") : "Open a LeetCode problem"}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Optional question */}
        <div className="space-y-2">
          <label htmlFor="q" className="flex items-center gap-2 text-sm font-medium text-bone">
            <MessageSquare className="w-4 h-4 text-gold" />
            What are you stuck on? <span className="text-dust font-normal">(optional)</span>
          </label>
          <textarea
            id="q"
            value={ladder.question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-lacquer-2 border border-line text-bone placeholder-dust/60 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold"
            placeholder="e.g. My answer is wrong when all numbers are negative"
          />
        </div>

        {/* Ladder */}
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
                    isNext ? `${r.fill} border-transparent text-floor` : `bg-lacquer-2 ${used ? r.ring : "border-line text-bone"} hover:bg-lacquer-3`
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-semibold text-sm">
                    {loadingLevel === r.level ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    {r.name}
                  </span>
                  <span className={`block text-[11px] ${isNext ? "text-floor/75" : "text-dust"}`}>
                    {used && !isNext ? "Ask again" : r.blurb}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-dust">
            Start with a nudge. Each step gives away more, so a solve after a pinpoint earns less mastery credit.
          </p>
        </div>

        {/* Hints so far */}
        {ladder.hints.length > 0 && (
          <div className="space-y-2">
            {ladder.hints.map((h, i) => {
              const r = RUNGS[(h.level ?? 1) - 1];
              return (
                <div key={h.at ?? i} className={`rounded-lg bg-lacquer-2 border-l-4 ${r.ring.split(" ")[0]} p-3 space-y-1.5`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-semibold ${r.ring.split(" ")[1]}`}>{r.name}</span>
                    {h.focusName && (
                      <span className="inline-flex items-center gap-1 text-bone">
                        <Target className="w-3 h-3" /> {h.focusName}
                      </span>
                    )}
                    {h.usedLastAttempt && <span className="text-dust">· uses your last run</span>}
                  </div>
                  <p className="text-sm text-bone whitespace-pre-wrap leading-relaxed">{h.text}</p>
                </div>
              );
            })}
            <button onClick={onReset} className="cursor-pointer inline-flex items-center gap-1 text-xs text-dust hover:text-bone">
              <RotateCcw className="w-3 h-3" /> Clear hints for this problem
            </button>
          </div>
        )}

        {/* API key */}
        <div className="border border-line p-3 rounded-md bg-lacquer-2">
          <button
            className="cursor-pointer w-full flex justify-between items-center select-none"
            onClick={() => setShowApiKeyInput((prev) => !prev)}
            aria-expanded={showApiKeyInput}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-bone">
              <KeyRound className="w-4 h-4 text-gold" /> Change API key
            </span>
            {showApiKeyInput ? <ChevronUp className="w-4 h-4 text-dust" /> : <ChevronDown className="w-4 h-4 text-dust" />}
          </button>
          {showApiKeyInput && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md bg-lacquer border border-line text-bone placeholder-dust/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                placeholder="Your Gemini API key"
              />
              <button onClick={handleApiKeySave} className="cursor-pointer w-full text-sm font-semibold py-2 rounded-md bg-strike hover:brightness-110 transition">
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
