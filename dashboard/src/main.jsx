import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { captureTokenFromUrl } from "./api.js";
import "./styles.css";

captureTokenFromUrl();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
