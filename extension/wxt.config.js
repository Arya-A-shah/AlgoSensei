import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: () => ({
    plugins: [react(), tailwindcss()],
  }),
  manifest: {
    name: "AlgoSensei",
    description: "Socratic hints on LeetCode, plus a map of what you actually understand — built from every run and submit.",
    web_accessible_resources: [
      {
        matches: ["*://leetcode.com/*"],
        resources: ["icon/*.png"],
      },
    ],
    permissions: ["storage", "tabs"],
    // The background worker posts events to the API; add your deployed API origin here too.
    host_permissions: ["*://leetcode.com/*", "http://localhost:3001/*"],
  },
  devServer: {
    port: 5175,
  },
});
