import { useState } from "react";
import { settings } from "../../../api.js";
import { refreshOverview } from "../ui.jsx";
import ThemePicker from "../../../ThemePicker.jsx";

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
    if (settings.token) refreshOverview();
  };

  return (
    <section className="page settings">
      <h1 className="h-page">Settings</h1>
      <form className="form" onSubmit={save} onChange={() => setSaved(false)}>
        <label className="field">
          <span>Server address</span>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://localhost:3001" />
        </label>
        <label className="field">
          <span>Gemini key <small>optional</small></span>
          <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} autoComplete="off" />
          <small>For drills, arena questions and re-grading. Stays in this browser.</small>
        </label>
        <label className="field">
          <span>Device token</span>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          <small>Set when you open the dashboard from the extension.</small>
        </label>
        <div className="form-actions">
          <button className="btn btn-strike" type="submit">Save settings</button>
          {saved && <span className="st-solid" role="status">Settings saved</span>}
        </div>
      </form>
      <ThemePicker />
    </section>
  );
}
