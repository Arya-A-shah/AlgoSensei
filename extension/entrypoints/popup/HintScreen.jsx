import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Brain, MessageSquare, KeyRound, ChevronDown, ChevronUp, Compass, Lightbulb, Crosshair, RotateCcw, Target } from "lucide-react";

// The ladder: each rung gives away more, so a later solve earns a little less credit.
const RUNGS = [
  { level: 1, name: "Nudge", icon: Compass, blurb: "Where to look", ring: "border-emerald-500 text-emerald-300", fill: "bg-emerald-700 hover:bg-emerald-600" },
  { level: 2, name: "Concept", icon: Lightbulb, blurb: "What's at stake", ring: "border-amber-500 text-amber-300", fill: "bg-amber-700 hover:bg-amber-600" },
  { level: 3, name: "Pinpoint", icon: Crosshair, blurb: "Exactly where", ring: "border-rose-500 text-rose-300", fill: "bg-rose-700 hover:bg-rose-600" },
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
    <div className="w-full max-w-sm bg-gray-900 text-white rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-700">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">AlgoSensei</h2>
          <p className="text-xs text-gray-400 truncate">{slug ? slug.replace(/-/g, " ") : "Open a LeetCode problem"}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Optional question */}
        <div className="space-y-2">
          <label htmlFor="q" className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            What are you stuck on? <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="q"
            value={ladder.question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    isNext ? `${r.fill} border-transparent text-white` : `bg-gray-800 ${used ? r.ring : "border-gray-700 text-gray-300"} hover:bg-gray-700`
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-semibold text-sm">
                    {loadingLevel === r.level ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    {r.name}
                  </span>
                  <span className={`block text-[11px] ${isNext ? "text-white/80" : "text-gray-400"}`}>
                    {used && !isNext ? "Ask again" : r.blurb}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500">
            Start with a nudge. Each step gives away more, so a solve after a pinpoint earns less mastery credit.
          </p>
        </div>

        {/* Hints so far */}
        {ladder.hints.length > 0 && (
          <div className="space-y-2">
            {ladder.hints.map((h, i) => {
              const r = RUNGS[(h.level ?? 1) - 1];
              return (
                <div key={h.at ?? i} className={`rounded-lg bg-gray-800 border-l-4 ${r.ring.split(" ")[0]} p-3 space-y-1.5`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-semibold ${r.ring.split(" ")[1]}`}>{r.name}</span>
                    {h.focusName && (
                      <span className="inline-flex items-center gap-1 text-gray-300">
                        <Target className="w-3 h-3" /> {h.focusName}
                      </span>
                    )}
                    {h.usedLastAttempt && <span className="text-gray-500">· uses your last run</span>}
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{h.text}</p>
                </div>
              );
            })}
            <button onClick={onReset} className="cursor-pointer inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200">
              <RotateCcw className="w-3 h-3" /> Clear hints for this problem
            </button>
          </div>
        )}

        {/* API key */}
        <div className="border border-gray-800 p-3 rounded-md bg-gray-800">
          <button
            className="cursor-pointer w-full flex justify-between items-center select-none"
            onClick={() => setShowApiKeyInput((prev) => !prev)}
            aria-expanded={showApiKeyInput}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <KeyRound className="w-4 h-4 text-yellow-400" /> Change API key
            </span>
            {showApiKeyInput ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showApiKeyInput && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md bg-gray-900 border border-gray-700 text-white placeholder-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your Gemini API key"
              />
              <button onClick={handleApiKeySave} className="cursor-pointer w-full text-sm font-semibold py-2 rounded-md bg-blue-600 hover:bg-blue-700 transition">
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
