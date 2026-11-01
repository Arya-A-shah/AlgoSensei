import { useState } from "react";
import { settings } from "./api.js";

const OPTIONS = [
  { id: "calm", name: "Calm", desc: "Clean study view with a light Japanese touch" },
  { id: "game", name: "Game", desc: "Sensei scene, dojo, weapons and arena" },
];

// Shared by every theme's Settings page. Switching reloads into the other theme.
export default function ThemePicker() {
  const [theme, setTheme] = useState(settings.theme);
  const pick = (id) => {
    if (id === theme) return;
    settings.theme = id;
    setTheme(id);
    location.reload();
  };
  return (
    <fieldset className="theme-picker">
      <legend>Theme</legend>
      {OPTIONS.map((o) => (
        <label key={o.id} className={`theme-option ${theme === o.id ? "is-on" : ""}`}>
          <input type="radio" name="theme" value={o.id} checked={theme === o.id} onChange={() => pick(o.id)} />
          <span><b>{o.name}</b><small>{o.desc}</small></span>
        </label>
      ))}
    </fieldset>
  );
}
