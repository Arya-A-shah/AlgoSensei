# 🥋 AlgoSensei extension

> A subtle hint engine for LeetCode — powered by AI.

![Logo](public/icon-128.png)

---

## ⚡️ Overview

**AlgoSensei** is a Chrome Extension built for LeetCode enthusiasts who want a *gentle nudge* in the right direction — not a spoiler.

Using **Google Gemini AI**, AlgoSensei analyzes your LeetCode solution and gives you **subtle, context-aware hints** to help you think deeper without handing over the answer.

Perfect for:

- 🧩 Stuck coders  
- 🎯 Interview prep warriors  
- 🤔 Curious learners  

---

## ✨ Features

- 🪜 A hint ladder: **Nudge → Concept → Pinpoint**, each giving away a little more  
- 🎯 Hints grounded in your last failing run, the concepts the problem tests, and your weak spots  
- 🧠 Every Run and Submit is captured and graded into your knowledge mirror  
- 💾 Hints for each problem survive closing the popup  
- 🌙 Clean, modern UI (dark mode supported)  
- 🔐 Secure local API key storage (never leaves your browser)  
- 💻 Works on all LeetCode problem pages  

---

## 🧩 How It Works

1. Install the extension
2. Paste your **Gemini API key**
3. On any LeetCode problem, click **Nudge** first
4. Still stuck? Step up to **Concept**, then **Pinpoint**. Each rung costs a little mastery credit on that problem

> It’s like having an AI mentor who helps *just enough* to help you learn.

---

## 🚀 Tech Stack

- ⚡️ [WXT](https://wxt.dev) – next-gen extension dev framework  
- ⚛️ React + TailwindCSS – beautiful UI, fast and minimal  
- 🔮 Google Gemini API – for intelligent hint generation  
- 🧩 Chrome APIs – tabs, storage, messaging

---

## 🧪 Local Development

```bash
npm install
npm run build
```
Then you can load-unpacked from the .output/chrome-mv3 folder
Built with ❤️ to help developers think better — not cheat better.
