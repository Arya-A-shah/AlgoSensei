import { useState } from "react";
import { settings } from "../api.js";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey);
  const [token, setToken] = useState(settings.token);
  const [saved, setSaved] = useState(false);

  const save = (e) => {
    e.preventDefault();
    settings.apiUrl = apiUrl.trim().replace(/\/$/, "");
    settings.geminiKey = geminiKey.trim();
    settings.token = token.trim();
    setSaved(true);
  };

  return (
    <section className="page">
      <h1 className="page-title">Settings</h1>
      <form className="form" onSubmit={save} onChange={() => setSaved(false)}>
        <label className="field">
          <span>API address</span>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://localhost:3001" />
        </label>
        <label className="field">
          <span>Gemini API key (optional)</span>
          <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Used for drills, review questions and re-analysis" autoComplete="off" />
          <small className="quiet">Kept in this browser and sent only to your API. Attempts from the extension already use the key you saved there.</small>
        </label>
        <label className="field">
          <span>Device token</span>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          <small className="quiet">Set automatically when you open the dashboard from the extension. Paste one here to view another browser’s data.</small>
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">Save settings</button>
          {saved && <span className="st-text-solid" role="status">Settings saved</span>}
        </div>
      </form>
    </section>
  );
}
