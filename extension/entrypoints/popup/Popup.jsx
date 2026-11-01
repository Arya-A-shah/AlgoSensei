import { useEffect, useState } from "react";
import ApiKeyScreen from "./ApiKeyScreen";
import HintScreen from "./HintScreen";
import { Toaster, toast } from "sonner";
import { getHint, getSession, loadLadder, saveLadder } from "./api";
import MirrorBar from "./MirrorBar";

// Asks the content script on the active LeetCode tab for the problem and the full code.
async function readPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.match(/^https:\/\/leetcode\.com\/problems\//)) return { error: "Open a LeetCode problem to get hints." };
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: "GET_LEETCODE_CODE" }, (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        resolve({ error: "Couldn't read the page. Reload the LeetCode tab and try again." });
      } else resolve(response);
    });
  });
}

const slugOfTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url?.match(/^https:\/\/leetcode\.com\/problems\/([^/]+)/)?.[1] ?? null;
};

const Popup = () => {
  const [apiKey, setApiKey] = useState("");
  const [showHintScreen, setShowHintScreen] = useState(false);
  const [slug, setSlug] = useState(null);
  // ladder = { hints: [{ level, levelName, text, focusName, grounded, usedLastAttempt }], question }
  const [ladder, setLadder] = useState({ hints: [], question: "" });
  const [loadingLevel, setLoadingLevel] = useState(null);

  useEffect(() => {
    chrome.storage.local.get(["GEMINI_API_KEY"], (result) => {
      if (result.GEMINI_API_KEY) {
        setApiKey(result.GEMINI_API_KEY);
        setShowHintScreen(true);
      }
    });
    (async () => {
      const s = await slugOfTab();
      setSlug(s);
      const saved = await loadLadder(s);
      if (saved) setLadder({ hints: saved.hints ?? [], question: saved.question ?? "" });
    })();
  }, []);

  const saveKey = () => {
    chrome.storage.local.set({ GEMINI_API_KEY: apiKey.trim() }, () => setShowHintScreen(true));
  };

  const setQuestion = (question) => {
    const next = { ...ladder, question };
    setLadder(next);
    saveLadder(slug, next);
  };

  const askLevel = async (level) => {
    setLoadingLevel(level);
    try {
      const page = await readPage();
      if (page.error) {
        toast.error(page.error);
        return;
      }
      const session = await getSession();
      const res = await getHint({
        code: page.code,
        question: ladder.question,
        title: page.title,
        description: page.description,
        slug: page.slug,
        level,
        apiKey,
        userToken: session?.token,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const entry = {
        level: res.level ?? level,
        levelName: res.levelName,
        text: res.hint,
        focusName: res.focusName ?? null,
        grounded: Boolean(res.grounded),
        usedLastAttempt: Boolean(res.usedLastAttempt),
        stripped: Boolean(res.stripped),
        at: Date.now(),
      };
      const next = { ...ladder, hints: [...ladder.hints, entry].slice(-6) };
      setLadder(next);
      setSlug(page.slug);
      saveLadder(page.slug, next);
    } finally {
      setLoadingLevel(null);
    }
  };

  const resetLadder = () => {
    const next = { hints: [], question: ladder.question };
    setLadder(next);
    saveLadder(slug, next);
  };

  return (
    <>
      <Toaster position="bottom-center" richColors />
      <div className="w-[360px] min-h-[400px] p-4 bg-panel text-ink font-sans text-sm rounded-md space-y-4 overflow-auto">
        {showHintScreen ? (
          <HintScreen
            slug={slug}
            ladder={ladder}
            loadingLevel={loadingLevel}
            onAsk={askLevel}
            onReset={resetLadder}
            setQuestion={setQuestion}
            apiKey={apiKey}
            setApiKey={setApiKey}
            saveKey={saveKey}
          />
        ) : (
          <ApiKeyScreen apiKey={apiKey} setApiKey={setApiKey} saveKey={saveKey} />
        )}
        <MirrorBar />
      </div>
    </>
  );
};

export default Popup;
