import { motion } from "framer-motion";
import { useState } from "react";
import { FaKey } from "react-icons/fa";
import { toast } from "sonner";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const ApiKeyScreen = ({ apiKey, setApiKey, saveKey }) => {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter a valid API key.");
      return;
    }

    saveKey();
    setSaved(true);
    toast.success("API key saved!");
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeIn}
      transition={{ duration: 0.4 }}
      className="p-5 min-w-[300px] max-w-[380px] bg-lacquer rounded-xl flex flex-col gap-6"
    >
      {/* Extension Title */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="text-ember shrink-0">
          <path d="M1 14 L12 3 L23 14 Q12 17 1 14 Z" fill="currentColor" />
        </svg>
        <h1 className="font-display text-3xl leading-none font-semibold text-bone pt-1">
          AlgoSensei
        </h1>
      </div>

      <hr className="border-t border-line" />

      {/* Prompt Header */}
      <div className="flex items-center gap-3">
        <FaKey className="text-gold text-lg" />
        <div>
          <h2 className="text-xl font-semibold text-bone">
            Set up Gemini API
          </h2>
          <p className="text-sm text-dust">
            Paste your key for hints and for grading your runs and submits.
          </p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-3"
      >
        <label
          htmlFor="api-key"
          className="text-sm font-medium text-dust"
        >
          Gemini API Key
        </label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza…"
          className="w-full rounded-md border border-line bg-lacquer text-bone placeholder-dust/60 px-3 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
          onClick={handleSave}
          className="cursor-pointer w-full rounded-md bg-strike hover:brightness-110 text-bone text-sm font-semibold py-2 transition"
        >
          {saved ? "✅ Saved!" : "Save API Key"}
        </motion.button>
      </motion.div>

      {/* Disclaimer */}
      <p className="text-xs text-dust text-center mt-1">
        Your key is stored in this browser and sent only to your AlgoSensei server, which uses it to call Gemini.
      </p>
    </motion.div>
  );
};

export default ApiKeyScreen;
