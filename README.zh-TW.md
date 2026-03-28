# Universal AI Agent Hub

> 🌐 [English](README.md)

免費、開源、無後端的 AI Agent，整合多個免費 LLM（OpenRouter / Groq / HuggingFace），內建 18+ 種即時工具。所有 API Key 存在你自己的瀏覽器，不經過任何伺服器。

**線上 Demo：** https://ai-free-token.pages.dev

---

### 📹 教學影片

> **[▶ 下載觀看：如何取得 API Key 並部署](https://github.com/ImperialManta/ai-agent-hub-free/releases/tag/v1.0)**
> 內容：OpenRouter 免費 Key 註冊 + Cloudflare Pages 部署全流程

---

### 功能特色

#### 雙模式架構
| 模式 | 說明 |
|------|------|
| ⚡ Fast | LangGraph 3 節點：Router → Tool → LLM，快速單次呼叫 |
| 🐺 Swarm | 多模型並行競速（OR + Groq + HF），由 groq/compound 聚合，適合複雜問題 |

#### 18+ 內建工具（自動偵測，無需手動選擇）
| 工具 | 觸發範例 |
|------|----------|
| 🔍 網路搜尋 | 「最新 AI 新聞」、「如何學習 Python」 |
| 📰 即時新聞 | 「今天科技新聞」、「台灣財經新聞」 |
| 🌤 天氣 | 「台北天氣」、「Tokyo weather」 |
| 💰 加密貨幣 | 「比特幣價格」、「ETH 現在多少」 |
| 📊 股票 | 「AAPL 股價」、「台積電股價」 |
| 💱 匯率 | 「100 美金換台幣」、「USD to TWD」 |
| 🎨 圖片生成 | 「生成一張貓咪圖片」、「生成一幅山水畫」 |
| 🧮 計算機 | 「123 * 456」、「sin(45) + cos(30)」 |
| 📖 維基百科 | 「維基 量子電腦」 |
| 🌍 IP 查詢 | 「我的 IP」、「8.8.8.8 在哪裡」 |
| 📱 QR Code | 「生成 QR Code https://...」 |
| 🔥 Hacker News | 「HN 熱門」 |
| 📐 arXiv | 「最新 LLM 論文」 |
| 🐙 GitHub | 「GitHub react 框架推薦」 |
| ▶️ YouTube 摘要 | 貼上任意 YouTube 連結 |
| 🌐 網頁摘要 | 貼上任意網址 |
| 📖 字典 | 「define serendipity」 |

#### 其他功能
- 🖼 **Canvas 即時預覽** — 生成 HTML/CSS/JS/React/SVG/Mermaid/Python 後自動彈出預覽
- 🎙 **語音輸入** — 按麥克風說話，自動轉文字（Groq Whisper）
- 🔊 **語音播放** — AI 回覆朗讀（Groq TTS）
- 📄 **文件 RAG** — 上傳 PDF/TXT/MD，AI 能閱讀並回答
- 🌙 **深色 / 紫色主題**
- 🇹🇼/🇺🇸 **繁體中文 / 英文介面切換**

---

### 所需 API Key

| Key | 用途 | 取得方式 | 費用 |
|-----|------|----------|------|
| **OpenRouter** ✅ 必填 | Fast 模式 LLM | [openrouter.ai](https://openrouter.ai) 免費註冊 | 免費 50 次/天 |
| Groq ⭐ 建議 | Swarm 模式、語音功能 | [console.groq.com](https://console.groq.com) 免費註冊 | 免費配額 |
| HuggingFace 選填 | 圖片生成、Swarm 強化 | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | 免費配額 |

---

### 部署方式

```bash
git clone https://github.com/ImperialManta/ai-agent-hub-free.git
cd ai-agent-hub-free
npm install
npm run build

# 部署到 Cloudflare Pages（需免費 Cloudflare 帳號）
npx wrangler login
npx wrangler pages deploy dist --project-name=你的專案名稱
```

**需求：** Node.js 18+ · 免費 [Cloudflare 帳號](https://dash.cloudflare.com/sign-up)

---

### 使用方式

1. 開啟你部署的網址
2. 點右上角 ⚙ 設定 → 輸入 OpenRouter API Key（必填）
3. 直接輸入問題，AI 自動選擇工具
4. 也可點輸入框下方的工具按鈕手動指定模式

---

### 技術架構

- **前端：** React + TypeScript + Vite
- **路由：** LangGraph 風格確定性路由（程式決定工具，LLM 不做工具呼叫決策）
- **LLM：** OpenRouter（8 個免費模型）→ Groq → HuggingFace
- **部署：** Cloudflare Pages（邊緣運算，全球 CDN）
- **儲存：** 僅 localStorage，零後端、零資料庫

---

### 授權

MIT — 自由使用、修改、分發
