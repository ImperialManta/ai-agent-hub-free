# Universal AI Agent Hub

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

### 簡介

一個免費、開源、無後端的 AI Agent，整合多個免費 LLM 提供商（OpenRouter / Groq / HuggingFace），並內建 18+ 種即時工具。所有 API Key 存在你自己的瀏覽器，不經過任何伺服器。

**線上 Demo：** https://ai-free-token.pages.dev

---

### 功能特色

#### 雙模式架構
| 模式 | 說明 |
|------|------|
| ⚡ Fast | LangGraph 3 節點：Router → Tool → LLM，單次呼叫，快速回應 |
| 🐺 Swarm | 多模型並行競速（OR + Groq + HF），由 groq/compound 聚合，適合複雜問題 |

#### 內建 18+ 工具（自動偵測，無需手動選擇）
| 工具 | 觸發範例 |
|------|----------|
| 🔍 網路搜尋 | 「最新 AI 新聞」、「如何學習 Python」 |
| 📰 即時新聞 | 「今天科技新聞」、「台灣財經新聞」 |
| 🌤 天氣 | 「台北天氣」、「Tokyo weather」 |
| 💰 加密貨幣 | 「比特幣價格」、「ETH 現在多少」 |
| 📊 股票 | 「AAPL 股價」、「台積電股價」 |
| 💱 匯率 | 「100 美金換台幣」、「USD to TWD」 |
| 🎨 圖片生成 | 「生成一張貓咪圖片」、「draw a sunset」 |
| 🧮 計算機 | 「123 * 456」、「sin(45) + cos(30)」 |
| 📖 維基百科 | 「維基 量子電腦」 |
| 🌍 IP 查詢 | 「我的 IP」、「8.8.8.8 在哪裡」 |
| 📱 QR Code | 「生成 QR Code https://...」 |
| 🔥 Hacker News | 「HN 熱門」 |
| 📐 arXiv | 「最新 LLM 論文」 |
| 🐙 GitHub | 「GitHub react 框架」 |
| ▶️ YouTube 摘要 | 貼上 YouTube 連結 |
| 🌐 網頁摘要 | 貼上任意網址 |
| 📖 字典 | 「define serendipity」 |
| 🎭 Browser（選配） | 截圖、操作網頁 |

#### 其他功能
- 🖼 **Canvas 即時預覽** — 生成 HTML/CSS/JS/React/SVG/Mermaid/Python 後自動彈出預覽
- 🎙 **語音輸入** — 按麥克風說話，自動轉文字（Groq Whisper）
- 🔊 **語音播放** — 點播放按鈕，AI 回覆朗讀（Groq TTS）
- 📄 **文件 RAG** — 上傳 PDF/TXT/MD，AI 能閱讀並回答文件內容
- 🌙 **深色/紫色主題** — 可切換
- 🇹🇼/🇺🇸 **繁中/英文介面** — 可切換

---

### 所需 API Key

| Key | 用途 | 取得方式 | 費用 |
|-----|------|----------|------|
| **OpenRouter** ✅ 必填 | Fast 模式 LLM | [openrouter.ai](https://openrouter.ai) 免費註冊 | 免費 50 req/day |
| Groq ⭐ 建議 | Swarm 模式、語音功能 | [console.groq.com](https://console.groq.com) 免費註冊 | 免費配額 |
| HuggingFace 選填 | 圖片生成、Swarm 強化 | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | 免費配額 |

---

### 部署方式

#### 方法一：Cloudflare Pages（推薦）

```bash
# 1. 複製專案
git clone https://github.com/ImperialManta/ai-agent-hub-free.git
cd ai-agent-hub-free

# 2. 安裝套件
npm install

# 3. 建置
npm run build

# 4. 部署到 Cloudflare Pages（需免費 Cloudflare 帳號）
npx wrangler login
npx wrangler pages deploy dist --project-name=你的專案名稱
```

#### 方法二：本機開發

```bash
npm install
npm run dev
# 開啟 http://localhost:5173
```

#### 系統需求
- Node.js 18+
- 免費 Cloudflare 帳號（部署用）

---

### 使用說明

1. 開啟你部署的網址
2. 點右上角 ⚙ 設定，輸入 OpenRouter API Key（必填）
3. 直接輸入問題，AI 會自動選擇工具
4. 也可以點輸入框下方的工具按鈕手動指定模式

---

## English

### Introduction

A free, open-source, serverless AI Agent hub integrating multiple free LLM providers (OpenRouter / Groq / HuggingFace) with 18+ built-in real-time tools. All API keys are stored locally in your browser — nothing goes through any server.

**Live Demo:** https://ai-free-token.pages.dev

---

### Features

#### Dual Mode Architecture
| Mode | Description |
|------|-------------|
| ⚡ Fast | LangGraph 3-node: Router → Tool → LLM. Single call, fast response |
| 🐺 Swarm | Multi-model parallel racing (OR + Groq + HF), aggregated by groq/compound. Best for complex queries |

#### 18+ Built-in Tools (auto-detected, no manual selection needed)
| Tool | Example Triggers |
|------|-----------------|
| 🔍 Web Search | "latest AI news", "how to learn Python" |
| 📰 Live News | "today's tech news", "crypto headlines" |
| 🌤 Weather | "weather in Tokyo", "台北天氣" |
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
| ▶️ YouTube Summary | Paste any YouTube link |
| 🌐 Web Summarize | Paste any URL |
| 📖 Dictionary | "define serendipity" |
| 🎭 Browser (optional) | Screenshot, web interaction |

#### Additional Features
- 🖼 **Canvas Live Preview** — Auto-opens when AI writes HTML/CSS/JS/React/SVG/Mermaid/Python code
- 🎙 **Voice Input** — Click mic to speak, auto-transcribed (Groq Whisper)
- 🔊 **Text-to-Speech** — Click play on any AI response (Groq TTS)
- 📄 **Document RAG** — Upload PDF/TXT/MD, AI reads and answers from content
- 🌙 **Dark/Purple themes**
- 🇹🇼/🇺🇸 **Traditional Chinese / English UI**

---

### Required API Keys

| Key | Purpose | Get it | Cost |
|-----|---------|--------|------|
| **OpenRouter** ✅ Required | Fast mode LLM | [openrouter.ai](https://openrouter.ai) free signup | Free 50 req/day |
| Groq ⭐ Recommended | Swarm mode + voice features | [console.groq.com](https://console.groq.com) free signup | Free quota |
| HuggingFace Optional | Image generation + Swarm boost | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Free quota |

---

### Deployment

#### Option 1: Cloudflare Pages (Recommended — Free)

```bash
# 1. Clone the repo
git clone https://github.com/ImperialManta/ai-agent-hub-free.git
cd ai-agent-hub-free

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Deploy to Cloudflare Pages (requires free Cloudflare account)
npx wrangler login
npx wrangler pages deploy dist --project-name=your-project-name
```

#### Option 2: Local Development

```bash
npm install
npm run dev
# Open http://localhost:5173
```

#### Requirements
- Node.js 18+
- Free Cloudflare account (for deployment)

---

### Quick Start

1. Open your deployed URL
2. Click ⚙ Settings in the top right, enter your OpenRouter API Key (required)
3. Type any question — the AI will automatically select the right tool
4. Or click the tool pills below the input to manually force a specific mode

---

### Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Routing:** LangGraph-style deterministic router (no LLM tool-calling)
- **LLM Providers:** OpenRouter (8 free models) → Groq → HuggingFace
- **Deployment:** Cloudflare Pages (edge, global CDN)
- **Storage:** localStorage only — zero backend, zero database

---

### License

MIT — free to use, modify, and distribute.
