# Universal AI Agent Hub

> 🌐 [繁體中文說明](README.zh-TW.md)

A free, open-source, serverless AI Agent hub integrating multiple free LLM providers with 18+ built-in real-time tools. All API keys are stored locally in your browser — nothing goes through any server.

**Live Demo:** https://ai-free-token.pages.dev

---

### 📹 Setup Guide (Video)

[![Watch the setup guide](https://img.youtube.com/vi/KPVFO_fx7s8/maxresdefault.jpg)](https://youtu.be/KPVFO_fx7s8)

> Covers: OpenRouter free key signup + Cloudflare Pages full deployment walkthrough

---

### Features

#### Dual Mode Architecture
| Mode | Description |
|------|-------------|
| ⚡ Fast | LangGraph 3-node: Router → Tool → LLM. Single call, fast response |
| 🐺 Swarm | Multi-model parallel racing (OR + Groq + HF), aggregated by groq/compound |

#### 18+ Built-in Tools (auto-detected, no manual selection needed)
| Tool | Example Triggers |
|------|-----------------|
| 🔍 Web Search | "latest AI news", "how to learn Python" |
| 📰 Live News | "today's tech news", "crypto headlines" |
| 🌤 Weather | "weather in Tokyo", "Paris weather" |
| 💰 Crypto | "Bitcoin price", "ETH right now" |
| 📊 Stock | "AAPL stock price", "TSMC stock" |
| 💱 Currency | "100 USD to TWD", "EUR to JPY" |
| 🎨 Image Gen | "generate a cat image", "draw a sunset" |
| 🧮 Calculator | "123 * 456", "sin(45) + cos(30)" |
| 📖 Wikipedia | "wiki quantum computing" |
| 🌍 IP Lookup | "my IP", "where is 8.8.8.8" |
| 📱 QR Code | "QR code for https://..." |
| 🔥 Hacker News | "HN top stories" |
| 📐 arXiv | "latest LLM papers" |
| 🐙 GitHub | "GitHub react frameworks" |
| ▶️ YouTube Summary | Paste any YouTube URL |
| 🌐 Web Summary | Paste any URL |
| 📖 Dictionary | "define serendipity" |

#### Additional Features
- 🖼 **Canvas Live Preview** — Auto-opens for HTML/CSS/JS/React/SVG/Mermaid/Python
- 🎙 **Voice Input** — Mic → auto-transcribed (Groq Whisper)
- 🔊 **Text-to-Speech** — AI responses read aloud (Groq TTS)
- 📄 **Document RAG** — Upload PDF/TXT/MD, AI reads and answers
- 🌙 **Dark / Purple themes**
- 🇹🇼/🇺🇸 **Traditional Chinese / English UI**

---

### Required API Keys

All keys are **free**. You only need OpenRouter to get started.

| Key | Purpose | Sign Up | Cost |
|-----|---------|---------|------|
| **OpenRouter** ✅ Required | Main LLM (Fast mode) | [openrouter.ai](https://openrouter.ai) | Free · 50 req/day |
| Groq ⭐ Recommended | Swarm mode + voice input/TTS | [console.groq.com](https://console.groq.com) | Free quota |
| HuggingFace (optional) | Image generation | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Free quota |

**How to get your OpenRouter API Key:**
1. Go to [openrouter.ai](https://openrouter.ai) → Sign up (free)
2. Click your profile → **Keys** → **Create Key**
3. Copy the key (starts with `sk-or-...`)

---

### Step-by-Step Deployment (No coding experience needed)

> **Prerequisites:** You need two free accounts — [GitHub](https://github.com) and [Cloudflare](https://dash.cloudflare.com/sign-up). No credit card required.

#### Step 1 — Install Node.js

Node.js is a runtime required to build this project.

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version
2. Run the installer, click Next all the way through
3. Open a terminal (Windows: press `Win + R`, type `cmd`, press Enter)
4. Verify it installed correctly:
   ```
   node --version
   ```
   You should see something like `v20.x.x`. As long as it's **v18 or higher**, you're good.

#### Step 2 — Download this project

In the terminal, run these commands one by one:

```bash
git clone https://github.com/ImperialManta/ai-agent-hub-free.git
cd ai-agent-hub-free
npm install
npm run build
```

> If you don't have `git`, download it from [git-scm.com](https://git-scm.com) first, or just click the green **Code → Download ZIP** button on this page and unzip it.

- `npm install` — downloads all dependencies (may take 1–2 minutes)
- `npm run build` — compiles the project into a `dist/` folder

#### Step 3 — Create a free Cloudflare account

1. Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Sign up with your email — no credit card needed
3. Verify your email

#### Step 4 — Deploy to Cloudflare Pages

Run these two commands in your terminal:

```bash
npx wrangler login
```

This will **automatically open your browser** and ask you to log in to Cloudflare. Click **Allow**.

Then deploy:

```bash
npx wrangler pages deploy dist --project-name=my-ai-hub
```

> Replace `my-ai-hub` with any name you like (lowercase letters and hyphens only). This becomes part of your URL, e.g. `my-ai-hub.pages.dev`.

After a few seconds you'll see:
```
✨ Deployment complete! Your site is live at: https://my-ai-hub.pages.dev
```

Open that URL in your browser — your AI hub is live!

---

### First-Time Setup (After Deployment)

1. Open your deployed URL (e.g. `https://my-ai-hub.pages.dev`)
2. Click the **⚙ gear icon** in the top-right corner
3. Paste your **OpenRouter API Key** into the first field
4. Click **Save**
5. Type any question in the chat box — the AI will automatically pick the right tool

You can also click the tool pills below the input box to manually select a mode (Search, Image, News, etc.).

---

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `node: command not found` | Node.js not installed — see Step 1 |
| `npm install` fails | Make sure you're inside the project folder (`cd ai-agent-hub-free`) |
| `wrangler login` doesn't open browser | Try running `npx wrangler login --browser` |
| Project name already taken | Choose a different name in the deploy command |
| AI says "no API key" | Click ⚙ Settings and enter your OpenRouter key |
| Rate limit error | Free tier is 50 requests/day — wait until tomorrow or add a Groq key |

---

### Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Routing:** LangGraph-style deterministic router (no LLM tool-calling)
- **LLM Providers:** OpenRouter (8 free models) → Groq → HuggingFace → DuckDuckGo AI
- **Deployment:** Cloudflare Pages (edge network, global CDN)
- **Storage:** localStorage only — zero backend, zero database

---

### License

MIT — free to use, modify, and distribute
