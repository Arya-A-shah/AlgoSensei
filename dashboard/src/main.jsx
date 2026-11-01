import React from "react";
import ReactDOM from "react-dom/client";
import { captureTokenFromUrl, settings } from "./api.js";

captureTokenFromUrl();

// Each theme is its own folder with its own components and styles; only the chosen one loads.
const THEMES = {
  calm: () => import("./themes/calm/index.jsx"),
  game: () => import("./themes/game/index.jsx"),
};

THEMES[settings.theme]().then(({ default: App }) => {
  document.documentElement.dataset.theme = settings.theme;
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
