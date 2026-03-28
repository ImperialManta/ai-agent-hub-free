# Universal AI Agent Hub

> 🌐 [繁體中文說明](README.zh-TW.md)

A free, open-source, serverless AI Agent hub integrating multiple free LLM providers with 18+ built-in real-time tools. All API keys are stored locally in your browser — nothing goes through any server.

**Live Demo:** https://ai-free-token.pages.dev

---

### 📹 Setup Guide (Video)

> How to get API keys and deploy your own instance:
> *(see Releases section for video)*

---

### Features

#### Dual Mode Architecture
| Mode | Description |
|------|-------------|
| ⚡ Fast | LangGraph 3-node: Router → Tool → LLM. Single call, fast response |
| 🐺 Swarm | Multi-model parallel racing (OR + Groq + HF), aggregated by groq/compound |

#### 18+ Built-in Tools (auto-detected)
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

| Key | Purpose | Get it | Cost |
|-----|---------|--------|------|
| **OpenRouter** ✅ Required | Fast mode LLM | [openrouter.ai](https://openrouter.ai) | Free 50 req/day |
| Groq ⭐ Recommended | Swarm + voice | [console.groq.com](https://console.groq.com) | Free quota |
| HuggingFace Optional | Image generation | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Free quota |

---

### Deployment

```bash
git clone https://github.com/ImperialManta/ai-agent-hub-free.git
cd ai-agent-hub-free
npm install
npm run build

# Deploy to Cloudflare Pages (free account required)
npx wrangler login
npx wrangler pages deploy dist --project-name=your-project-name
```

**Requirements:** Node.js 18+ · Free [Cloudflare account](https://dash.cloudflare.com/sign-up)

---

### Quick Start

1. Open your deployed URL
2. Click ⚙ Settings → enter your OpenRouter API Key
3. Type any question — AI auto-selects the right tool
4. Or click tool pills below input to force a specific mode

---

### Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Routing:** LangGraph-style deterministic router (no LLM tool-calling)
- **LLM Providers:** OpenRouter (8 free models) → Groq → HuggingFace
- **Deployment:** Cloudflare Pages
- **Storage:** localStorage only — zero backend, zero database

---

### License

MIT
