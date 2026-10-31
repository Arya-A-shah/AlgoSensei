import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { captureTokenFromUrl } from "./api.js";
import "@fontsource/teko/latin-400.css";
import "@fontsource/teko/latin-500.css";
import "@fontsource/teko/latin-600.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "./styles.css";

captureTokenFromUrl();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
