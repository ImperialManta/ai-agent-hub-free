# Universal AI Agent Hub

> 🌐 [English](README.md)

免費、開源、無後端的 AI Agent，整合多個免費 LLM（OpenRouter / Groq / HuggingFace），內建 18+ 種即時工具。所有 API Key 存在你自己的瀏覽器，不經過任何伺服器。

**線上 Demo：** https://ai-free-token.pages.dev

---

### 📹 教學影片

[![觀看教學影片](https://img.youtube.com/vi/KPVFO_fx7s8/maxresdefault.jpg)](https://youtu.be/KPVFO_fx7s8)

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

全部免費，只需要 OpenRouter 就能開始使用。

| Key | 用途 | 取得方式 | 費用 |
|-----|------|----------|------|
| **OpenRouter** ✅ 必填 | 主要 LLM（Fast 模式） | [openrouter.ai](https://openrouter.ai) 免費註冊 | 免費 50 次/天 |
| Groq ⭐ 建議填 | Swarm 模式、語音輸入/朗讀 | [console.groq.com](https://console.groq.com) 免費註冊 | 免費配額 |
| HuggingFace（選填） | 圖片生成 | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | 免費配額 |

**如何取得 OpenRouter API Key：**
1. 前往 [openrouter.ai](https://openrouter.ai) → 免費註冊
2. 點右上角頭像 → **Keys** → **Create Key**
3. 複製產生的 Key（開頭是 `sk-or-...`）

---

### 部署步驟（完全不需要程式基礎）

> **前置需求：** 需要兩個免費帳號 — [GitHub](https://github.com) 和 [Cloudflare](https://dash.cloudflare.com/sign-up)，都不需要信用卡。

#### 第一步 — 安裝 Node.js

Node.js 是用來編譯這個專案的工具。

1. 前往 [nodejs.org](https://nodejs.org)，下載 **LTS** 版本
2. 執行安裝程式，一直按「下一步」即可
3. 開啟終端機（Windows：按 `Win + R`，輸入 `cmd`，按 Enter）
4. 輸入以下指令確認安裝成功：
   ```
   node --version
   ```
   看到類似 `v20.x.x` 的字樣，只要是 **v18 以上**就沒問題。

#### 第二步 — 下載這個專案

在終端機中，依序輸入以下指令：

```bash
git clone https://github.com/ImperialManta/ai-agent-hub-free.git
cd ai-agent-hub-free
npm install
npm run build
```

> 如果沒有 `git`，請先至 [git-scm.com](https://git-scm.com) 下載安裝。或是直接點這個頁面上方的綠色 **Code → Download ZIP** 按鈕，解壓縮後再繼續。

- `npm install`：下載所有套件（約需 1–2 分鐘）
- `npm run build`：將專案編譯到 `dist/` 資料夾

#### 第三步 — 建立 Cloudflare 免費帳號

1. 前往 [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. 用 Email 免費註冊，不需要信用卡
3. 驗證 Email

#### 第四步 — 部署到 Cloudflare Pages

在終端機輸入：

```bash
npx wrangler login
```

這個指令會**自動打開瀏覽器**，要求你登入 Cloudflare，點「Allow」授權即可。

然後執行部署：

```bash
npx wrangler pages deploy dist --project-name=my-ai-hub
```

> 把 `my-ai-hub` 改成你想要的名稱（只能用小寫英文和連字號）。這個名稱會成為你的網址，例如 `my-ai-hub.pages.dev`。

幾秒後看到：
```
✨ Deployment complete! Your site is live at: https://my-ai-hub.pages.dev
```

用瀏覽器開啟那個網址，你的 AI Hub 就上線了！

---

### 首次使用設定

1. 開啟你部署的網址（例如 `https://my-ai-hub.pages.dev`）
2. 點右上角的 **⚙ 齒輪圖示**
3. 在第一個欄位貼上你的 **OpenRouter API Key**
4. 點 **儲存**
5. 在聊天框輸入任何問題，AI 會自動選擇對應工具

也可以點輸入框下方的工具按鈕，手動指定要使用的模式（搜尋、圖片、新聞等）。

---

### 常見問題排解

| 問題 | 解決方式 |
|------|----------|
| `node: command not found` | Node.js 未安裝，請看第一步 |
| `npm install` 失敗 | 確認你在專案資料夾內（`cd ai-agent-hub-free`） |
| `wrangler login` 沒有開啟瀏覽器 | 試試 `npx wrangler login --browser` |
| 專案名稱已被使用 | 在部署指令中換一個不同的名稱 |
| AI 說「沒有 API Key」 | 點 ⚙ 設定，輸入 OpenRouter Key |
| 出現次數限制錯誤 | 免費版每天 50 次，明天重置；或新增 Groq Key 增加額度 |

---

### 技術架構

- **前端：** React + TypeScript + Vite
- **路由：** LangGraph 風格確定性路由（程式決定工具，LLM 不做工具呼叫決策）
- **LLM：** OpenRouter（8 個免費模型）→ Groq → HuggingFace → DuckDuckGo AI
- **部署：** Cloudflare Pages（邊緣運算，全球 CDN）
- **儲存：** 僅 localStorage，零後端、零資料庫

---

### 授權

MIT — 自由使用、修改、分發
