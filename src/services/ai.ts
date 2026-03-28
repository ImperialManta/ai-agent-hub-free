import Groq from "groq-sdk";
import { fetchMemory, saveRagChunks, fetchRagChunks, deleteRagSource } from "./memory";

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_MODELS = {
  planner:    "llama-3.1-8b-instant",           // 14.4K RPD — fast planner
  soldiers:   [
    "moonshotai/kimi-k2-instruct",              // ✅ 60 RPM, 1K RPD
    "meta-llama/llama-4-scout-17b-16e-instruct",// ✅ 30K TPM, 1K RPD
    "openai/gpt-oss-20b",                       // ✅ 1K RPD
    "qwen/qwen3-32b",                           // ✅ 60 RPM, 1K RPD
  ],
  aggregator: "groq/compound",                  // ✅ 70K TPM, 250 RPD — confirmed working
  vision:     "meta-llama/llama-4-scout-17b-16e-instruct", // llama-3.2-11b decommissioned 2026-03
  audio:      "whisper-large-v3-turbo",
  tts:        "canopylabs/orpheus-v1-english",
};

// OR free models — live-tested with real API key (2026-03-19)
const OR_FREE = [
  "google/gemma-3-27b-it:free",               // ✅ 200 OK
  "google/gemma-3-12b-it:free",               // ✅ 200 OK
  "nvidia/nemotron-3-super-120b-a12b:free",   // ✅ 200 OK
  "nvidia/nemotron-nano-9b-v2:free",          // ✅ 200 OK
  "z-ai/glm-4.5-air:free",                    // ✅ 200 OK
  "stepfun/step-3.5-flash:free",              // ✅ 200 OK
  "arcee-ai/trinity-large-preview:free",      // ✅ 200 OK
  "nvidia/nemotron-3-nano-30b-a3b:free",      // ✅ 200 OK
];

// DuckDuckGo AI Chat — uses JS challenge bypass (x-vqd-hash-1 eval in browser context)
// Models from duck.ai UI (2026-03):
const DDG_MODELS = [
  "gpt-4o-mini",                                          // GPT-4o mini (OpenAI)
  "gpt-5-mini",                                           // GPT-5 mini (OpenAI)
  "meta-llama/Meta-Llama-4-Scout-17B-16E-Instruct",      // Llama 4 Scout (Meta)
  "claude-haiku-4-5-20251001",                            // Claude Haiku 4.5 (Anthropic)
  "mistralai/Mistral-Small-3.1-24B-Instruct-2503",       // Mistral Small 3
  "openai/gpt-oss-120b",                                  // GPT-OSS 120B
];

// Tools that return self-explanatory data — skip LLM synthesis entirely
const DIRECT_TOOLS = new Set([
  'calc', 'currency', 'weather', 'crypto', 'stock', 'ip', 'qr', 'time',
  'define', 'hackernews', 'youtube', 'github',
]);

// HF models — live-tested 2026-03-27 via router.huggingface.co
const HF_MODELS = [
  "meta-llama/Llama-3.3-70B-Instruct",    // ✅ best quality
  "Qwen/Qwen2.5-72B-Instruct",            // ✅ great quality
  "meta-llama/Llama-3.1-70B-Instruct",    // ✅ solid
  "Qwen/Qwen2.5-Coder-32B-Instruct",      // ✅ good all-round
  "Qwen/Qwen2.5-7B-Instruct",             // ✅ fast fallback
  "meta-llama/Llama-3.1-8B-Instruct",     // ✅ fast fallback
];

// ─────────────────────────────────────────────────────────────────────────────
// FETCH HELPERS — direct fetch, no SDK (avoids browser connection errors)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchChat(
  url: string,
  headers: Record<string, string>,
  model: string,
  messages: any[],
  maxTokens = 800,
  onUsage?: (u: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.status.toString());
    throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (onUsage && data.usage) onUsage(data.usage);
  return data.choices?.[0]?.message?.content || "";
}

async function groqFetch(apiKey: string, model: string, messages: any[], maxTokens = 800, onUsage?: Parameters<typeof fetchChat>[5]) {
  return fetchChat(
    "https://api.groq.com/openai/v1/chat/completions",
    { "Authorization": `Bearer ${apiKey}` },
    model, messages, maxTokens, onUsage
  );
}

async function orFetch(apiKey: string, model: string, messages: any[], maxTokens = 800, onUsage?: Parameters<typeof fetchChat>[5]) {
  return fetchChat(
    "https://openrouter.ai/api/v1/chat/completions",
    { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "http://localhost:5173", "X-Title": "AI Agent Hub" },
    model, messages, maxTokens, onUsage
  );
}

// Strip <think>...</think> blocks produced by reasoning models (Qwen3, DeepSeek-R1)
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
}

async function hfFetch(token: string, model: string, messages: any[], maxTokens = 800, onUsage?: Parameters<typeof fetchChat>[5]) {
  const raw = await fetchChat(
    "https://router.huggingface.co/v1/chat/completions",
    { "Authorization": `Bearer ${token}` },
    model, messages, maxTokens, onUsage
  );
  return stripThinking(raw);
}

// Fast single-model fetch via OR with streaming
async function orFetchStream(
  apiKey: string,
  model: string,
  messages: any[],
  onChunk: (chunk: string) => void,
  onUsage: Parameters<typeof fetchChat>[5],
  maxTokens = 3000,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://ai-free-token.pages.dev",
      "X-Title": "Universal AI",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403 || err.includes("Missing Authentication") || err.includes("Invalid API")) {
      throw new Error("__AUTH_ERROR__");
    }
    if (res.status === 429) {
      // Distinguish daily-quota exhausted from model-overload / RPM limit
      const isDaily = err.includes("daily") || err.includes("tomorrow") || err.includes("free-models-per-day") || err.includes("exceeded your");
      throw new Error(isDaily ? "__RATE_LIMIT_DAILY__" : "__RATE_LIMIT_RPM__");
    }
    throw new Error(`OR ${res.status}: ${err.slice(0, 120)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "", ptok = 0, ctok = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const d = JSON.parse(line.slice(6));
        const tok = d.choices?.[0]?.delta?.content;
        if (tok) { full += tok; onChunk(tok); }
        if (d.usage) { ptok = d.usage.prompt_tokens ?? 0; ctok = d.usage.completion_tokens ?? 0; }
      } catch { /* ignore SSE parse errors */ }
    }
  }
  if (ptok || ctok) onUsage?.({ prompt_tokens: ptok, completion_tokens: ctok, total_tokens: ptok + ctok });
  return full;
}

// ─────────────────────────────────────────────────────────────────────────────
// DDG AI CHAT — free, no API key, uses Llama 3.1 70B via DuckDuckGo
// ─────────────────────────────────────────────────────────────────────────────

async function ddgFetch(
  messages: any[],
  onChunk?: (c: string) => void,
  modelIdx = 0,
): Promise<string> {
  // Merge system messages into first user message (DDG only supports user/assistant)
  const ddgMsgs: { role: string; content: string }[] = [];
  let sysPrefix = "";
  for (const m of messages) {
    if (m.role === "system") { sysPrefix += m.content + "\n\n"; }
    else if (m.role === "user") {
      ddgMsgs.push({ role: "user", content: sysPrefix ? sysPrefix + m.content : m.content });
      sysPrefix = "";
    } else {
      ddgMsgs.push({ role: m.role, content: m.content });
    }
  }
  if (!ddgMsgs.length) throw new Error("DDG: no messages");

  // Step 1: get VQD auth token (supports both old x-vqd-4 and new JS-challenge x-vqd-hash-1)
  const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status?chat=1", {
    headers: { "x-vqd-accept": "1" },
    signal: AbortSignal.timeout(8000),
    credentials: "omit",
  });

  const chatHeaders: Record<string, string> = { "Content-Type": "application/json" };

  const vqd4 = statusRes.headers.get("x-vqd-4");
  if (vqd4) {
    // Old API: direct token
    chatHeaders["x-vqd-4"] = vqd4;
  } else {
    const vqdHashChallenge = statusRes.headers.get("x-vqd-hash-1");
    if (!vqdHashChallenge) throw new Error("DDG: no auth token");
    // New API: base64-encoded JS challenge — execute in browser context to get fingerprint token
    const challengeJs = atob(vqdHashChallenge);
    // eslint-disable-next-line no-eval
    const tokenObj = await (0, eval)(`(${challengeJs})`);
    if (!tokenObj || typeof tokenObj !== "object") throw new Error("DDG: challenge eval failed");
    chatHeaders["x-vqd-hash-1"] = JSON.stringify(tokenObj);
  }

  // Step 2: stream chat
  const model = DDG_MODELS[modelIdx % DDG_MODELS.length];
  const res = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
    method: "POST",
    headers: chatHeaders,
    body: JSON.stringify({ model, messages: ddgMsgs }),
    signal: AbortSignal.timeout(30000),
    credentials: "omit",
  });
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  if (!res.body) throw new Error("DDG: no body");

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.message) { full += d.message; onChunk?.(d.message); }
      } catch { /* ignore */ }
    }
  }
  if (!full) throw new Error("DDG: empty response");
  return full;
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG — BM25 (industry-standard ranking, much better than TF-IDF)
// ─────────────────────────────────────────────────────────────────────────────

interface Chunk { text: string; source: string; tokens: string[]; }

function tokenize(text: string) {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
}

// BM25 parameters
const BM25_K1 = 1.5;
const BM25_B  = 0.75;

class RAGStore {
  private chunks: Chunk[] = [];
  private df: Record<string, number> = {};   // document frequency per term
  private avgdl = 0;

  private _reindex() {
    this.df = {};
    let total = 0;
    for (const c of this.chunks) {
      total += c.tokens.length;
      const seen = new Set<string>();
      for (const t of c.tokens) {
        if (!seen.has(t)) { this.df[t] = (this.df[t] || 0) + 1; seen.add(t); }
      }
    }
    this.avgdl = this.chunks.length ? total / this.chunks.length : 1;
  }

  // addDocumentLocal: add to BM25 store without triggering D1 sync (used when loading from D1)
  addDocumentLocal(text: string, source = "document") {
    this.chunks = this.chunks.filter(c => c.source !== source);
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i += 150) {
      const slice = words.slice(i, i + 150).join(" ");
      this.chunks.push({ text: slice, source, tokens: tokenize(slice) });
    }
    this._reindex();
    this._save().catch(() => {});
  }

  // addDocument: add + sync to D1
  addDocument(text: string, source = "document") {
    this.addDocumentLocal(text, source);
    // Sync new chunks to D1
    const newChunks = this.chunks
      .filter(c => c.source === source)
      .map(c => ({ text: c.text, tokens: c.tokens }));
    saveRagChunks(source, newChunks).catch(() => {});
  }

  retrieve(query: string, topK = 4): string {
    if (!this.chunks.length) return "";
    const N = this.chunks.length;
    const qTokens = tokenize(query);
    const scored = this.chunks.map(c => {
      const tf: Record<string, number> = {};
      for (const t of c.tokens) tf[t] = (tf[t] || 0) + 1;
      let score = 0;
      for (const qt of qTokens) {
        const idf = Math.log((N - (this.df[qt] || 0) + 0.5) / ((this.df[qt] || 0) + 0.5) + 1);
        const f = tf[qt] || 0;
        score += idf * (f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + BM25_B * c.tokens.length / this.avgdl));
      }
      return { c, score };
    });
    return scored.sort((a, b) => b.score - a.score)
      .slice(0, topK).filter(x => x.score > 0)
      .map(x => `[${x.c.source}]\n${x.c.text}`).join("\n\n");
  }

  hasContent() { return this.chunks.length > 0; }

  clearSource(source: string) {
    this.chunks = this.chunks.filter(c => c.source !== source);
    this._reindex();
    this._save().catch(() => {});
  }

  clear() {
    this.chunks = []; this.df = {}; this.avgdl = 0;
    indexedDB.deleteDatabase("rag_store");
  }

  // IndexedDB persistence
  private async _save() {
    const db = await this._db();
    const tx = db.transaction("chunks", "readwrite");
    const store = tx.objectStore("chunks");
    await new Promise<void>(r => { const req = store.clear(); req.onsuccess = () => r(); });
    for (const c of this.chunks) {
      await new Promise<void>(r => { const req = store.add(c); req.onsuccess = () => r(); });
    }
  }

  async load() {
    try {
      const db = await this._db();
      const tx = db.transaction("chunks", "readonly");
      const store = tx.objectStore("chunks");
      const all: Chunk[] = await new Promise((res, rej) => {
        const req = store.getAll(); req.onsuccess = () => res(req.result); req.onerror = rej;
      });
      if (all.length) { this.chunks = all; this._reindex(); }
    } catch { /* ignore */ }
  }

  private _db(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      const req = indexedDB.open("rag_store", 1);
      req.onupgradeneeded = e => (e.target as IDBOpenDBRequest).result.createObjectStore("chunks", { autoIncrement: true });
      req.onsuccess = e => res((e.target as IDBOpenDBRequest).result);
      req.onerror = rej;
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: ROUTER — deterministic intent detection (LangGraph-style)
// Code decides which tools to run. LLM NEVER makes this decision.
// ─────────────────────────────────────────────────────────────────────────────

type Intent =
  | { type: 'image';      prompt: string }
  | { type: 'weather';    city: string }
  | { type: 'search';     query: string }
  | { type: 'news';       query: string }
  | { type: 'crypto';     coin: string }
  | { type: 'stock';      symbol: string }
  | { type: 'currency';   from: string; to: string; amount: number }
  | { type: 'calc';       expr: string }
  | { type: 'wiki';       query: string }
  | { type: 'youtube';    url: string }
  | { type: 'url';        url: string }
  | { type: 'ip';         ip: string }
  | { type: 'qr';         data: string }
  | { type: 'define';     word: string }
  | { type: 'hackernews' }
  | { type: 'arxiv';      query: string }
  | { type: 'github';     query: string }
  | { type: 'chat' }

const CRYPTO_IDS: Record<string, string> = {
  btc:'bitcoin', eth:'ethereum', sol:'solana', xrp:'ripple',
  ada:'cardano', doge:'dogecoin', bnb:'binancecoin', dot:'polkadot',
  avax:'avalanche-2', matic:'matic-network', pol:'matic-network',
  link:'chainlink', ltc:'litecoin', shib:'shiba-inu', uni:'uniswap',
  atom:'cosmos', fil:'filecoin', apt:'aptos', sui:'sui',
  trx:'tron', xlm:'stellar', algo:'algorand',
  比特幣:'bitcoin', 以太幣:'ethereum', 以太坊:'ethereum', 乙太幣:'ethereum',
  索拉納:'solana', 狗狗幣:'dogecoin', 萊特幣:'litecoin', 幣安幣:'binancecoin',
  瑞波幣:'ripple', 柴犬幣:'shiba-inu',
};

// Build an Intent from a user-selected tool override (bypasses routerNode)
function buildForcedIntent(tool: string, userText: string): Intent {
  switch (tool) {
    case 'search':   return { type: 'search',  query: userText };
    case 'image':    return { type: 'image',   prompt: userText };
    case 'news':     return { type: 'news',    query: userText };
    case 'wiki':     return { type: 'wiki',    query: userText };
    case 'hackernews': return { type: 'hackernews' };
    case 'arxiv':    return { type: 'arxiv',   query: userText };
    case 'github':   return { type: 'github',  query: userText };
    case 'weather': {
      const r = routerNode(userText);
      const w = r.find(i => i.type === 'weather');
      return w ?? { type: 'weather', city: userText };
    }
    case 'crypto': {
      const r = routerNode(userText);
      const c = r.find(i => i.type === 'crypto');
      return c ?? { type: 'crypto', coin: userText.toLowerCase() };
    }
    case 'stock': {
      const r = routerNode(userText);
      const s = r.find(i => i.type === 'stock');
      return s ?? { type: 'stock', symbol: userText.toUpperCase() };
    }
    case 'currency': {
      const r = routerNode(userText);
      const cu = r.find(i => i.type === 'currency');
      return cu ?? { type: 'currency', from: 'USD', to: 'TWD', amount: 1 };
    }
    case 'calc':     return { type: 'calc', expr: userText };
    default:         return { type: 'chat' };
  }
}

function routerNode(text: string): Intent[] {
  const t = text.trim();
  const lc = t.toLowerCase();

  // ── YouTube URL ──────────────────────────────────────────────────────────
  if (/youtube\.com\/(?:watch|shorts|embed)|youtu\.be\//.test(lc)) {
    const m = t.match(/https?:\/\/[^\s]+/);
    if (m) return [{ type: 'youtube', url: m[0] }];
  }

  // ── Generic URL (not image gen) ──────────────────────────────────────────
  if (/https?:\/\//.test(t) && !/生成|generate|draw|create/.test(lc)) {
    const m = t.match(/https?:\/\/[^\s]+/);
    if (m) return [{ type: 'url', url: m[0] }];
  }

  // ── Image generation ─────────────────────────────────────────────────────
  if (/生成.*圖|生圖|生成一[張幅]|幫我生成一[張幅]|畫一[張幅]|畫.*圖|幫我.*圖|generate.*image|create.*image|draw.*image|image\s+of\s+a|a\s+photo\s+of|picture\s+of|draw\s+(?:me\s+)?(?:a\s+|an\s+)?|paint\s+(?:a\s+|an\s+)?/.test(lc)) {
    const prompt = t
      .replace(/^(please\s+)?(generate|draw|create|paint|生成|畫|幫我生成|幫我畫)\s*(me\s+)?(an?\s*)?(image|圖片|圖|picture|photo|一[張幅])?(\s*of)?\s*/i, '')
      .trim() || t;
    return [{ type: 'image', prompt }];
  }

  // ── QR code ──────────────────────────────────────────────────────────────
  if (/qr\s*(code|碼)|生成.*qr/.test(lc)) {
    const data = t.replace(/.*(?:qr\s*(?:code|碼)?|generate)\s*/i, '').trim() || t;
    return [{ type: 'qr', data }];
  }

  // ── IP lookup ────────────────────────────────────────────────────────────
  if (/my\s+ip|ip\s+address|ip\s+查詢|我的\s*ip|what.*my\s+ip/.test(lc)) return [{ type: 'ip', ip: '' }];
  // Only match IP addresses when explicitly mentioned as IP (avoid version number false-positives)
  if (/(?:ip|address|geolocation|locate)\b/i.test(lc) && /\b(\d{1,3}\.){3}\d{1,3}\b/.test(t)) {
    const m = t.match(/\b((\d{1,3}\.){3}\d{1,3})\b/);
    return [{ type: 'ip', ip: m?.[1] || '' }];
  }

  // ── Calculator ───────────────────────────────────────────────────────────
  const calcClean = t.replace(/[,，\s]/g, '');
  if (/^[\d+\-*/().^%]+$/.test(calcClean) && calcClean.length > 1) return [{ type: 'calc', expr: calcClean }];
  const calcMatch = t.match(/(?:calculate|compute|計算)[:\s]+(.+)/i);
  if (calcMatch) return [{ type: 'calc', expr: calcMatch[1].trim() }];

  // ── Weather — checked BEFORE search to prevent "今天天氣" routing to search ─
  if (/weather|天氣|氣溫|溫度|forecast|下雨|會下雨|幾度/.test(lc)) {
    let city = '';
    const weatherPatterns: Array<RegExpMatchArray | null> = [
      t.match(/(?:weather\s+(?:in|for|at)\s+)([A-Za-z][A-Za-z\s]{1,20})/i),
      t.match(/([A-Za-z]{3,20})\s+weather/i),
      t.match(/([^\s,，。？?！\u3000]+)(?:的\s*)?(?:天氣|氣溫|溫度)/),
      t.match(/(?:天氣|氣溫|溫度|forecast)\s*[,，]?\s*([A-Za-z\u4e00-\u9fff]{2,15})/),
    ];
    for (const m of weatherPatterns) {
      if (m?.[1]) {
        const raw = m[1].trim();
        if (raw.length >= 2 && !/今天|現在|明天|最近|如何|怎樣|怎麼|什麼|甚麼|的$/.test(raw)) {
          city = CJK_CITY_MAP[raw] || CJK_CITY_MAP[raw.replace(/市|都|縣|省/g, '')] || raw;
          break;
        }
      }
    }
    return [{ type: 'weather', city: city || 'Taipei' }];
  }

  // ── Crypto ───────────────────────────────────────────────────────────────
  for (const [key, id] of Object.entries(CRYPTO_IDS)) {
    if (lc.includes(key)) return [{ type: 'crypto', coin: id }];
  }

  // ── Stock ────────────────────────────────────────────────────────────────
  if (/stock|share|股票|股價/.test(lc)) {
    const m = t.match(/(?:stock|share|股票|股價)\s+(?:of\s+)?([A-Z]{1,5}|\d{4})/i) || t.match(/\b([A-Z]{2,5})\b.*(?:stock|share|股票)/i);
    if (m) return [{ type: 'stock', symbol: m[1].toUpperCase() }];
  }

  // ── Currency / Exchange rate ──────────────────────────────────────────────
  const cur3 = t.match(/(\d+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:to|換|兌|轉|→|->|=)\s*([A-Z]{3})/i);
  if (cur3) return [{ type: 'currency', from: cur3[2].toUpperCase(), to: cur3[3].toUpperCase(), amount: parseFloat(cur3[1]) }];
  const cur2 = t.match(/([A-Z]{3})\s*(?:to|換|兌|轉|→|->|\/)\s*([A-Z]{3})/i);
  if (cur2) return [{ type: 'currency', from: cur2[1].toUpperCase(), to: cur2[2].toUpperCase(), amount: 1 }];
  if (/匯率|exchange rate|換算/.test(lc)) {
    const cs = t.match(/\b(USD|TWD|EUR|JPY|GBP|CNY|HKD|KRW|AUD|CAD|SGD|THB|VND)\b/gi) || [];
    if (cs.length >= 2) return [{ type: 'currency', from: cs[0]!.toUpperCase(), to: cs[1]!.toUpperCase(), amount: 1 }];
  }

  // ── Wikipedia ────────────────────────────────────────────────────────────
  if (/^(?:wiki|wikipedia)\s+/i.test(lc)) {
    return [{ type: 'wiki', query: t.replace(/^(?:wiki|wikipedia)\s+/i, '').trim() }];
  }

  // ── Dictionary ───────────────────────────────────────────────────────────
  if (/^(?:define|what does|meaning of)\s+/i.test(lc)) {
    const word = t.replace(/^(?:define|what does|meaning of)\s+/i, '').replace(/\s+mean\??$/i, '').trim();
    return [{ type: 'define', word }];
  }

  // ── Hacker News ──────────────────────────────────────────────────────────
  if (/hacker.?news|hackernews|\bhn\b/.test(lc)) return [{ type: 'hackernews' }];

  // ── arXiv ────────────────────────────────────────────────────────────────
  if (/arxiv|academic paper|research paper/.test(lc)) {
    const query = t.replace(/.*(?:arxiv|academic paper|research paper)\s+(?:about|on)?\s*/i, '').trim() || t;
    return [{ type: 'arxiv', query }];
  }

  // ── GitHub ───────────────────────────────────────────────────────────────
  if (/github|open.?source\s+repo/.test(lc)) {
    const query = t.replace(/.*(?:github|open.?source\s+repo)\s+(?:for|about|of)?\s*/i, '').trim() || t;
    return [{ type: 'github', query }];
  }

  // ── News ─────────────────────────────────────────────────────────────────
  if (/latest news|breaking news|新聞|頭條|headline/.test(lc)) {
    const query = t.replace(/.*(?:latest news|breaking news|新聞|頭條)\s*(?:about|關於)?\s*/i, '').trim() || t;
    return [{ type: 'news', query }];
  }

  // ── Search — factual / current events / explicit search request ──────────
  if (/search|搜尋|搜索|look up|最新|latest|2025|2026|今天|today|現在|right now|how to|what is|who is|when|where|why|哪裡|如何|為什麼|幾時/.test(lc)) {
    const query = t.replace(/^(?:please\s+)?(?:search\s+(?:for|about)?|搜尋|搜索|find|查|找)\s*/i, '').trim() || t;
    return [{ type: 'search', query }];
  }

  // ── Fallback: pure chat ───────────────────────────────────────────────────
  return [{ type: 'chat' }];
}

// Convert Intent[] → ToolCall[] for runTool dispatcher
function intentToToolCall(intent: Intent): ToolCall {
  return intent as unknown as ToolCall;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLS — all free, no extra API key
// ─────────────────────────────────────────────────────────────────────────────

interface ToolCall { type: string; [k: string]: any; }

async function toolWiki(query: string) {
  try {
    const sd = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=2`)).json();
    const title = sd.query?.search?.[0]?.title;
    if (!title) return "No Wikipedia result.";
    const s = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)).json();
    return `**${s.title}** (Wikipedia): ${s.extract?.slice(0, 900) || "No summary."}`;
  } catch { return "Wikipedia search failed."; }
}

function toolCalc(expr: string) {
  try {
    if (!/^[\d\s+\-*/().^%,]+$/.test(expr)) return "Invalid expression.";
    // eslint-disable-next-line no-new-func
    return `**${expr} = ${Function(`"use strict"; return (${expr})`)()}**`;
  } catch { return "Calculation error."; }
}

const WMO_CODES: Record<number, string> = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Fog",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",
  80:"Light showers",81:"Showers",82:"Heavy showers",95:"Thunderstorm",99:"Thunderstorm with hail",
};

// Common CJK city names → English (instant lookup, no API call)
const CJK_CITY_MAP: Record<string, string> = {
  // Taiwan
  東京:"Tokyo", 台北:"Taipei", 台灣:"Taipei", 台中:"Taichung", 高雄:"Kaohsiung", 新竹:"Hsinchu",
  台南:"Tainan", 基隆:"Keelung", 桃園:"Taoyuan",
  // Japan
  大阪:"Osaka", 京都:"Kyoto", 福岡:"Fukuoka", 名古屋:"Nagoya", 札幌:"Sapporo",
  神戶:"Kobe", 橫濱:"Yokohama", 仙台:"Sendai",
  // Korea
  首爾:"Seoul", 釜山:"Busan", 仁川:"Incheon", 大邱:"Daegu",
  // China
  北京:"Beijing", 上海:"Shanghai", 廣州:"Guangzhou", 深圳:"Shenzhen",
  成都:"Chengdu", 武漢:"Wuhan", 西安:"Xian", 重慶:"Chongqing", 杭州:"Hangzhou",
  南京:"Nanjing", 天津:"Tianjin", 青島:"Qingdao",
  // Hong Kong / Macau
  香港:"Hong Kong", 澳門:"Macao",
  // Southeast Asia
  新加坡:"Singapore", 曼谷:"Bangkok", 胡志明市:"Ho Chi Minh City",
  河內:"Hanoi", 吉隆坡:"Kuala Lumpur", 馬尼拉:"Manila", 雅加達:"Jakarta",
  // Europe
  倫敦:"London", 巴黎:"Paris", 柏林:"Berlin", 羅馬:"Rome", 馬德里:"Madrid",
  阿姆斯特丹:"Amsterdam", 維也納:"Vienna", 布魯塞爾:"Brussels", 蘇黎世:"Zurich",
  // Americas
  紐約:"New York", 洛杉磯:"Los Angeles", 舊金山:"San Francisco",
  芝加哥:"Chicago", 西雅圖:"Seattle", 波士頓:"Boston", 邁阿密:"Miami",
  溫哥華:"Vancouver", 多倫多:"Toronto", 蒙特婁:"Montreal",
  // Oceania
  雪梨:"Sydney", 墨爾本:"Melbourne", 奧克蘭:"Auckland",
  // Middle East / South Asia / Africa
  迪拜:"Dubai", 開羅:"Cairo", 孟買:"Mumbai", 德里:"Delhi",
  特拉維夫:"Tel Aviv", 伊斯坦堡:"Istanbul",
};

async function toolWeather(city: string) {
  try {
    // Translate CJK city name to English (geocoding API only supports ASCII/Latin)
    let searchCity = city;
    if (isNonEnglish(city)) {
      searchCity = CJK_CITY_MAP[city] || CJK_CITY_MAP[city.replace(/市|都|縣|省/g, "")];
      if (!searchCity) {
        // Fallback: translate via mymemory
        try {
          const d = await (await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(city)}&langpair=zh|en`
          )).json();
          const t = d.responseData?.translatedText;
          if (t && t !== city) searchCity = t;
        } catch { /* use original */ }
        searchCity = searchCity || city;
      }
    }

    // Step 1: geocode city name → lat/lon
    const geo = await (await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchCity)}&count=1&language=en&format=json`
    )).json();
    const loc = geo.results?.[0];
    if (!loc) return `Cannot find city: ${city} (searched: ${searchCity})`;

    // Step 2: get current weather
    const w = await (await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&timezone=auto&forecast_days=1`
    )).json();
    const c = w.current;
    const desc = WMO_CODES[c.weather_code] ?? `Code ${c.weather_code}`;
    const tempF = (c.temperature_2m * 9/5 + 32).toFixed(1);
    return `**Weather in ${loc.name}, ${loc.country}**: ${desc}, ${c.temperature_2m}°C / ${tempF}°F (feels like ${c.apparent_temperature}°C), Humidity ${c.relative_humidity_2m}%, Wind ${c.wind_speed_10m} km/h\nSource: Open-Meteo (open-meteo.com) · Updated: ${new Date().toUTCString()}`;
  } catch (e: any) { return `Weather fetch failed: ${e.message}`; }
}

function toolTime(timezone?: string) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `**Time (${tz})**: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'long', timeZone: tz }).format(new Date())}`;
}

async function toolCurrency(from: string, to: string, amount = 1) {
  try {
    const d = await (await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`)).json();
    const rate = d.rates?.[to.toUpperCase()];
    if (!rate) return `Currency ${to} not found.`;
    return `**${amount} ${from.toUpperCase()} = ${(amount * rate).toFixed(4)} ${to.toUpperCase()}** (rate: ${rate})\nSource: open.er-api.com · Updated: ${new Date().toUTCString()}`;
  } catch { return "Currency fetch failed."; }
}

async function toolTranslate(text: string, to: string, from = "en") {
  try {
    const d = await (await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${from}|${to}`)).json();
    return `**Translation (→${to})**: ${d.responseData?.translatedText || "Failed"}`;
  } catch { return "Translation failed."; }
}

async function toolUrl(url: string) {
  try {
    const text = await (await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" } })).text();
    return `**Content of ${url}**:\n${text.slice(0, 2000)}`;
  } catch { return `Cannot read ${url}.`; }
}

// Detect if string contains non-Latin characters (CJK, Arabic, Thai, etc.)
function isNonEnglish(text: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0e00-\u0e7f]/.test(text);
}

// Auto-translate prompt to English for image models (FLUX is English-only)
async function toEnglishPrompt(prompt: string): Promise<string> {
  if (!isNonEnglish(prompt)) return prompt;
  try {
    const d = await (await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(prompt.slice(0, 400))}&langpair=zh|en`
    )).json();
    const translated = d.responseData?.translatedText;
    // mymemory returns the original if it can't translate
    if (translated && translated !== prompt && !translated.toLowerCase().includes("mymemory")) {
      return translated;
    }
  } catch { /* fallback to original */ }
  return prompt;
}

async function toolImage(prompt: string, hfToken: string) {
  if (!hfToken) return "⚠️ HF Token not set. Add it in Settings (optional).";

  // Image models are English-only — auto-translate if needed
  const enPrompt = await toEnglishPrompt(prompt);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
            "x-wait-for-model": "true",
          },
          body: JSON.stringify({ inputs: enPrompt }),
          signal: AbortSignal.timeout(90000),
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        if ((e.error?.includes("loading") || res.status === 503) && attempt === 0) {
          await new Promise(r => setTimeout(r, 8000));
          continue;
        }
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      // Store original prompt (user's language) for display, enPrompt used for generation
      return `__IMG__${dataUrl}__PROMPT__${prompt}`;
    } catch (e: any) {
      if (attempt === 1) break;
    }
  }
  return "Image generation failed (all models timed out or unavailable).";
}

function toolQR(data: string) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=220x220&margin=10`;
  return `**QR Code** for "${data}":\n\n![QR Code](${url})`;
}

async function toolSearch(query: string) {
  try {
    // Use Jina to proxy DuckDuckGo Lite — real-time web results, CORS-safe
    const raw = await (await fetch(
      `https://r.jina.ai/https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "text/plain" } }
    )).text();

    // Parse markdown: numbered results like "1.[Title](https://url)\nSnippet"
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const results: string[] = [];
    for (let i = 0; i < lines.length && results.length < 6; i++) {
      // Match full markdown link: 1.[Title](https://url)
      const linkMatch = lines[i].match(/^\d+\.\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (!linkMatch) continue;
      const title  = linkMatch[1].trim();
      const rawUrl = linkMatch[2].trim();
      // DDG wraps links in tracker redirects: duckduckgo.com/l/?uddg=<encoded-url>
      // Decode to get the real destination URL. Ads use y.js?ad_domain=... (no uddg).
      const uddg = rawUrl.match(/[?&]uddg=([^&]+)/)?.[1];
      const url  = uddg ? decodeURIComponent(uddg) : rawUrl;
      // Skip any URL that still resolves to duckduckgo.com (ads, tracker pages)
      if (url.includes("duckduckgo.com")) continue;
      // Find snippet: next non-empty line that isn't another link or URL
      let snippet = "";
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const l = lines[j];
        if (!l.match(/^\d+\.\[/) && !l.match(/^https?:\/\//) && l.length > 10) {
          snippet = l.replace(/\*\*/g, ""); break;
        }
      }
      if (snippet && !snippet.includes("Sponsored") && snippet.length > 15) {
        results.push(`**${title}**\n${snippet.slice(0, 280)}\n🔗 ${url}`);
        i += 2;
      }
    }
    return results.length
      ? `**Web Search** — "${query}" (Source: DuckDuckGo via Jina):\n\n${results.join("\n\n---\n\n")}`
      : await toolWiki(query);
  } catch { return await toolWiki(query); }
}

// ── Hacker News (free, no key) ──────────────────────────────────────────────
async function toolHackerNews() {
  try {
    const ids: number[] = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json")).json();
    const top = await Promise.all(ids.slice(0, 5).map(async id => {
      const s = await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
      return `**${s.title}** ⬆${s.score} pts\n_${s.url || "news.ycombinator.com"}_`;
    }));
    return `**Hacker News — Top 5**:\n\n${top.join("\n\n---\n\n")}`;
  } catch { return "Hacker News fetch failed."; }
}

// ── arXiv academic papers (free, no key) ────────────────────────────────────
async function toolArxiv(query: string) {
  try {
    const xml = await (await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=3&sortBy=relevance`)).text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => {
      const title   = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g," ").trim() || "";
      const summary = m[1].match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().slice(0, 250) || "";
      const id      = m[1].match(/<id>(.*?)<\/id>/)?.[1]?.trim() || "";
      return `**${title}**\n${summary}…\n_${id}_`;
    });
    return entries.length ? `**arXiv** — "${query}":\n\n${entries.join("\n\n---\n\n")}` : "No arXiv results.";
  } catch { return "arXiv search failed."; }
}

// ── GitHub repo search (free, no key) ───────────────────────────────────────
async function toolGithub(query: string) {
  try {
    const d = await (await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`, {
      headers: { Accept: "application/vnd.github+json" }
    })).json();
    const repos = (d.items || []).map((r: any) =>
      `**${r.full_name}** ⭐${r.stargazers_count.toLocaleString()}\n${r.description || ""}\n_${r.html_url}_`
    );
    return repos.length ? `**GitHub** — "${query}":\n\n${repos.join("\n\n---\n\n")}` : "No GitHub results.";
  } catch { return "GitHub search failed."; }
}

// ── English Dictionary (free, no key) ───────────────────────────────────────
async function toolDefine(word: string) {
  try {
    const d = await (await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)).json();
    if (!Array.isArray(d) || !d[0]) return `No definition found for "${word}".`;
    const entry = d[0];
    const meanings = (entry.meanings || []).slice(0, 3).map((m: any) =>
      `**${m.partOfSpeech}**: ${m.definitions?.[0]?.definition || ""}`
    ).join("\n");
    const phonetic = entry.phonetic || entry.phonetics?.[0]?.text || "";
    return `**${entry.word}** ${phonetic}\n\n${meanings}`;
  } catch { return `Dictionary lookup failed for "${word}".`; }
}

// ── News — fetch RSS directly (Google News blocks Jina) ─────────────────────
async function toolNews(query: string) {
  try {
    // Fetch RSS directly (no Jina proxy — Google News blocks it)
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
    const xml = await (await fetch(rssUrl)).text();
    // Parse <item> entries from RSS
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6);
    if (!items.length) return await toolSearch(query);
    const results = items.map(m => {
      const title = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
                 || m[1].match(/<title>([^<]+)<\/title>/)?.[1] || "";
      const link  = m[1].match(/<link>([^<]+)<\/link>/)?.[1]
                 || m[1].match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1] || "";
      const pub   = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || "";
      const src   = m[1].match(/<source[^>]*>([^<]+)<\/source>/)?.[1] || "";
      return `**${title.trim()}**${src ? ` — ${src}` : ""}${pub ? ` (${pub.slice(5,16)})` : ""}\n🔗 ${link.trim()}`;
    }).filter(r => r.length > 10);
    return results.length
      ? `**News** — "${query}" (Source: Google News RSS):\n\n${results.join("\n\n---\n\n")}`
      : await toolSearch(query);
  } catch { return await toolSearch(query); }
}

// ── IP geolocation (free, no key) ───────────────────────────────────────────
async function toolIP(ip = "") {
  try {
    const d = await (await fetch(`https://ipapi.co/${ip}/json/`)).json();
    if (d.error) return `Cannot lookup IP${ip ? ` "${ip}"` : ""}.`;
    const city    = d.city     ?? d.region   ?? "Unknown";
    const region  = d.region   ?? "Unknown";
    const country = d.country_name ?? d.country ?? "Unknown";
    return `**IP${ip ? ` ${ip}` : " (your IP)"}**: ${d.ip ?? "N/A"}\nLocation: ${city}, ${region}, ${country}\nISP: ${d.org ?? "Unknown"}\nTimezone: ${d.timezone ?? "Unknown"}\nCoords: ${d.latitude ?? "?"}, ${d.longitude ?? "?"}\nSource: ipapi.co`;
  } catch { return "IP lookup failed."; }
}

// ── Crypto prices (CoinGecko — free, no key) ────────────────────────────────
async function toolCrypto(coin: string) {
  try {
    const id = coin.toLowerCase().replace(/\s+/g, "-");
    const d = await (await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,twd&include_24hr_change=true&include_market_cap=true`
    )).json();
    if (!d[id]) {
      // fallback: search by symbol
      const list = await (await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coin)}`)).json();
      const match = list.coins?.[0];
      if (!match) return `Crypto "${coin}" not found on CoinGecko.`;
      return toolCrypto(match.id);
    }
    const p = d[id];
    const change = p.usd_24h_change?.toFixed(2) ?? "?";
    const sign   = parseFloat(change) >= 0 ? "+" : "";
    const mcap   = p.usd_market_cap ? ` | MCap $${(p.usd_market_cap/1e9).toFixed(2)}B` : "";
    return `**${coin.toUpperCase()}**: $${p.usd?.toLocaleString()} USD (${sign}${change}% 24h)${mcap}\nNT$${p.twd?.toLocaleString() ?? "N/A"} TWD\nSource: CoinGecko (api.coingecko.com) · ${new Date().toUTCString()}`;
  } catch (e: any) { return `Crypto lookup failed: ${e.message}`; }
}

// ── Stock price (Yahoo Finance unofficial) ───────────────────────────────────
async function toolStock(symbol: string) {
  try {
    const d = await (await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )).json();
    const meta = d.chart?.result?.[0]?.meta;
    if (!meta) return `Stock "${symbol}" not found.`;
    const price  = meta.regularMarketPrice;
    const prev   = meta.chartPreviousClose;
    const change = prev ? ((price - prev) / prev * 100).toFixed(2) : "?";
    const sign   = parseFloat(change) >= 0 ? "+" : "";
    return `**${meta.symbol}** (${meta.fullExchangeName}): $${price?.toFixed(2)} ${meta.currency} (${sign}${change}%)\nHigh: $${meta.regularMarketDayHigh?.toFixed(2)} | Low: $${meta.regularMarketDayLow?.toFixed(2)}\nSource: Yahoo Finance · Updated: ${new Date().toUTCString()}`;
  } catch (e: any) { return `Stock lookup failed: ${e.message}`; }
}

// ── YouTube — video info + transcript via Jina ───────────────────────────────
async function toolYoutube(urlOrId: string) {
  try {
    const id = urlOrId.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1]
            || (urlOrId.length === 11 ? urlOrId : null);
    if (!id) return `Invalid YouTube URL or video ID: "${urlOrId}"`;
    // Get title via oEmbed
    const info = await (await fetch(
      `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${id}&format=json`
    )).json().catch(() => null);
    // Get transcript text via Jina
    const raw = await (await fetch(
      `https://r.jina.ai/https://www.youtube.com/watch?v=${id}`,
      { headers: { Accept: "text/plain" } }
    )).text().catch(() => "");
    const title  = info?.title  || id;
    const author = info?.author_name || "Unknown";
    // Extract transcript section from page text
    const lines = raw.split("\n").filter(l => l.trim().length > 15 && !l.includes("http"));
    const excerpt = lines.slice(0, 40).join("\n").slice(0, 3000);
    return `**YouTube: ${title}**\nBy: ${author}\nURL: https://youtu.be/${id}\n\n${excerpt || "Could not extract transcript — video may have no captions."}`;
  } catch (e: any) { return `YouTube lookup failed: ${e.message}`; }
}

// ── Playwright browse — real browser, JS-rendered content ────────────────────
async function toolBrowse(url: string, pwUrl?: string): Promise<string> {
  // Try local Playwright server first (real browser, handles JS, auth, dynamic content)
  if (pwUrl) {
    try {
      const res = await fetch(`${pwUrl}/browse?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const d = await res.json();
        const linkList = (d.links || []).slice(0, 5).map((l: any) => `- [${l.text}](${l.href})`).join("\n");
        return `**🎭 [Browser] ${d.title || url}**\n\n${d.text?.slice(0, 3000) || "Empty page"}${linkList ? `\n\n**Links:**\n${linkList}` : ""}`;
      }
    } catch { /* fall through to Jina */ }
  }
  // Fallback: Jina proxy (works in production / Cloudflare Pages)
  return toolUrl(url);
}

// ── Playwright screenshot — capture & describe with vision ───────────────────
async function toolScreenshot(url: string, pwUrl?: string): Promise<string> {
  if (!pwUrl) return `⚠️ Playwright server not running. Start with: npm run dev:pw\n\nFallback:\n${await toolUrl(url)}`;
  try {
    const res = await fetch(`${pwUrl}/screenshot?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    // Return as markdown image — vision model in next turn can analyze it
    return `**📸 Screenshot of ${d.title || url}**:\n\n![screenshot](${d.screenshot})\n\n_URL: ${url}_`;
  } catch (e: any) {
    return `Screenshot failed: ${e.message}. Is playwright server running? (npm run dev:pw)`;
  }
}

// ── MCP server tool call (JSON-RPC 2.0) ─────────────────────────────────────
async function toolMCP(mcpUrl: string, toolName: string, args: Record<string, any>) {
  try {
    const res = await fetch(`${mcpUrl.replace(/\/$/, "")}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
    });
    const data = await res.json();
    const content = data.result?.content;
    if (Array.isArray(content)) return content.map((c: any) => c.text || JSON.stringify(c)).join("\n");
    return JSON.stringify(data.result || data);
  } catch (e: any) { return `MCP call failed: ${e.message}`; }
}

async function runTool(t: ToolCall, hfToken: string, mcpUrl?: string, pwUrl?: string): Promise<string> {
  try {
    switch (t.type) {
      case "wiki":        return await toolWiki(t.query);
      case "calc":        return toolCalc(t.expr);
      case "weather":     return await toolWeather(t.city);
      case "time":        return toolTime(t.timezone);
      case "currency":    return await toolCurrency(t.from, t.to, t.amount);
      case "translate":   return await toolTranslate(t.text, t.to, t.from);
      case "url":         return await toolUrl(t.url);
      case "image":       return await toolImage(t.prompt, hfToken);
      case "qr":          return toolQR(t.data);
      case "search":      return await toolSearch(t.query);
      case "hackernews":  return await toolHackerNews();
      case "arxiv":       return await toolArxiv(t.query);
      case "github":      return await toolGithub(t.query);
      case "define":      return await toolDefine(t.word);
      case "news":        return await toolNews(t.query);
      case "ip":          return await toolIP(t.ip);
      case "crypto":      return await toolCrypto(t.coin);
      case "stock":       return await toolStock(t.symbol);
      case "youtube":     return await toolYoutube(t.url);
      case "browse":      return await toolBrowse(t.url, pwUrl);
      case "screenshot":  return await toolScreenshot(t.url, pwUrl);
      case "mcp":         return mcpUrl ? await toolMCP(mcpUrl, t.tool, t.args || {}) : "MCP not configured.";
      default:            return `Unknown tool: ${t.type}`;
    }
  } catch (e: any) { return `Tool "${t.type}" error: ${e.message}`; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  calls: number;
}

export class AiAgentService {
  private groqKey = "";
  private orKey = "";
  private hfToken = "";
  private clawUrl = "";
  private clawToken = "";
  private mcpUrl = "";
  // Playwright local server — auto-detected from .env, fallback Jina in production
  private pwUrl = (import.meta.env.VITE_PLAYWRIGHT_URL as string) || "";
  private groqSdk: Groq | null = null; // SDK only for audio (STT/TTS)
  // Token tracking — resets per chat() call, exposed for UI display
  private _tokens: TokenUsage = { prompt: 0, completion: 0, total: 0, calls: 0 };
  get lastTokens(): TokenUsage { return { ...this._tokens }; }
  private rag = new RAGStore();
  private soul = "";   // loaded from D1 memory[soul]
  private userCtx = ""; // loaded from D1 memory[user]
  private lang = "zh"; // UI language — zh → Traditional Chinese, en → English

  constructor() {
    this.rag.load(); // restore from IndexedDB (fast, local)
    this._loadMemory(); // async load soul + user from D1
  }

  private async _loadMemory() {
    try {
      const mem = await fetchMemory();
      if (mem.soul)  this.soul    = mem.soul;
      if (mem.user)  this.userCtx = mem.user;
      // Sync RAG chunks from D1 into local BM25 store
      const chunks = await fetchRagChunks();
      if (chunks.length) {
        const bySource: Record<string, typeof chunks> = {};
        for (const c of chunks) {
          (bySource[c.source] ??= []).push(c);
        }
        for (const [src, cs] of Object.entries(bySource)) {
          const text = cs.map(c => c.text).join(" ");
          this.rag.addDocumentLocal(text, src);
        }
      }
    } catch { /* D1 unavailable in local dev — silently skip */ }
  }

  // ── LLM with full fallback cascade ───────────────────────────────────────
  // Tries all OR_FREE models in sequence. Only quits on AUTH error or total exhaustion.
  // (DDG removed: blocked by CORS + JS bot-challenge as of 2026-03)
  private async _llmWithFallback(
    startModel: string,
    msgs: any[],
    onStatus?: (s: string) => void,
    onChunk?: (chunk: string) => void,
    trackUsage?: Parameters<typeof orFetchStream>[4],
    maxTokens = 4000,
  ): Promise<string> {
    if (!this.orKey) {
      const out = "⚠️ No OpenRouter key — please add one in ⚙ Settings.";
      onChunk?.(out); return out;
    }

    const order = [startModel, ...OR_FREE.filter(m => m !== startModel)];
    for (const model of order) {
      try {
        if (onChunk) {
          return await orFetchStream(this.orKey, model, msgs, onChunk, trackUsage ?? (() => {}), maxTokens);
        } else {
          return await orFetch(this.orKey, model, msgs, maxTokens, trackUsage);
        }
      } catch (e: any) {
        const msg = e?.message ?? "";
        if (msg === "__AUTH_ERROR__") {
          const out = "⚠️ OpenRouter API key invalid — please re-enter it in ⚙ Settings.";
          onChunk?.(out); return out;
        }
        onStatus?.(`⚡ [Fallback] ${model.split("/").pop()} ${msg === "__RATE_LIMIT_DAILY__" ? "daily limit" : "busy"}, trying next…`);
      }
    }

    // ── Tier 3: DDG AI Chat (browser JS-challenge bypass) ────────────────
    try {
      onStatus?.("🦆 [DDG AI] OR exhausted, trying DDG…");
      return await ddgFetch(msgs, onChunk);
    } catch { /* CORS or challenge failed — give up */ }

    const out = "⚠️ All free models are currently busy or rate-limited. Please wait a moment and try again, or add credits at openrouter.ai.";
    onChunk?.(out); return out;
  }

  updateKeys(groqKey: string, orKey: string, hfToken = "", clawUrl = "", clawToken = "", mcpUrl = "", pwUrl?: string) {
    this.groqKey = groqKey;
    this.orKey = orKey;
    this.hfToken = hfToken;
    this.clawUrl = clawUrl.replace(/\/$/, "");
    this.clawToken = clawToken;
    this.mcpUrl = mcpUrl.replace(/\/$/, "");
    // Allow Settings override; keep env default if not provided
    if (pwUrl !== undefined) this.pwUrl = pwUrl.replace(/\/$/, "");
    if (groqKey) this.groqSdk = new Groq({ apiKey: groqKey, dangerouslyAllowBrowser: true });
  }

  setLang(lang: string) { this.lang = lang; }
  addDocument(text: string, source?: string) { this.rag.addDocument(text, source); }
  clearRAG(source?: string) {
    if (source) {
      this.rag.clearSource(source);
      deleteRagSource(source).catch(() => {});
    } else {
      this.rag.clear();
      deleteRagSource().catch(() => {});
    }
  }

  // ── TTS (uses SDK for binary audio) ────────────────────────────────────────
  async tts(text: string): Promise<ArrayBuffer> {
    if (!this.groqSdk) throw new Error("No Groq key");
    const res = await (this.groqSdk.audio.speech as any).create({
      model: GROQ_MODELS.tts, voice: "tara", input: text.slice(0, 2000),
    });
    return res.arrayBuffer();
  }

  // ── STT (uses SDK for multipart upload) ────────────────────────────────────
  async transcribe(file: File): Promise<string> {
    if (!this.groqSdk) return "No Groq key";
    const r = await this.groqSdk.audio.transcriptions.create({ file, model: GROQ_MODELS.audio });
    return r.text;
  }

  // ── FAST MODE — LangGraph 3-node: Router → Tool → LLM ──────────────────
  async chatFast(messages: Message[], onStatus?: (s: string) => void, imageBase64?: string, onChunk?: (chunk: string) => void, forcedTool?: string): Promise<string> {
    if (!this.orKey) return "⚠️ OpenRouter key missing — open Settings.";
    this._tokens = { prompt: 0, completion: 0, total: 0, calls: 0 };
    const trackUsage = (u: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => {
      this._tokens.prompt     += u.prompt_tokens     || 0;
      this._tokens.completion += u.completion_tokens || 0;
      this._tokens.total      += u.total_tokens      || 0;
      this._tokens.calls++;
    };

    const rawText = (messages[messages.length - 1]?.content as string) || "";
    const userText = rawText.trim() || (imageBase64 ? "Please describe this image." : "Hello");

    const nowTW = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const nowEN = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const langInstr = this.lang === 'zh'
      ? "🔴 MANDATORY LANGUAGE RULE: 你必須且只能使用【繁體中文】回答，嚴禁使用簡體中文。無論資料來源是何種語言，輸出一律為繁體中文。繁體用字：國時體語這為與來說學對從（NOT 国时体语这为与来说学对从）。"
      : "Always respond in English.";

    // ── NODE 1: Router — deterministic, no LLM ───────────────────────────────
    const intents = (forcedTool && forcedTool !== 'auto')
      ? [buildForcedIntent(forcedTool, userText)]
      : routerNode(userText);
    const intent  = intents[0];
    const toolLabel: Record<string, string> = {
      search:"🌐 Search", weather:"⛅ Weather", crypto:"🪙 Crypto", stock:"📈 Stock",
      currency:"💱 Currency", news:"📰 News", image:"🎨 Image", calc:"🧮 Calc",
      wiki:"🔍 Wiki", define:"📖 Dict", ip:"🌍 IP", qr:"📱 QR", url:"📄 URL",
      youtube:"▶️ YouTube", hackernews:"🔥 HN", arxiv:"📐 arXiv", github:"🐙 GitHub",
      chat:"💬 Chat",
    };

    // ── NODE 2: Tool Executor — run if needed ─────────────────────────────────
    let toolContext = "";
    if (intent.type !== 'chat') {
      const label = toolLabel[intent.type] || intent.type;
      const isImg = intent.type === 'image';
      onStatus?.(`🛠️ [Fast] ${label}${isImg ? " (up to 90s cold start)" : ""}…`);

      let ragContext = "";
      if (this.rag.hasContent()) {
        onStatus?.("📚 [RAG] Retrieving relevant chunks...");
        ragContext = this.rag.retrieve(userText);
      }

      try {
        const result = await runTool(intentToToolCall(intent), this.hfToken, this.mcpUrl, this.pwUrl);

        // Early-exit for image — skip LLM entirely
        if (result.startsWith("__IMG__")) {
          const dataUrl  = result.replace(/^__IMG__/, "").replace(/__PROMPT__.+$/, "");
          const imgPrompt = result.match(/__PROMPT__(.+)$/)?.[1] || "generated image";
          onStatus?.("🎨 [Image] Generated successfully!");
          return `**Generated Image** ("${imgPrompt}"):\n\n![${imgPrompt}](${dataUrl})`;
        }

        // ── Direct tools: return data as-is, no LLM token wasted ─────────────
        if (DIRECT_TOOLS.has(intent.type)) {
          onStatus?.(`✅ [${intent.type}] Done`);
          onChunk?.(result);
          return result;
        }

        toolContext = result;

        // ── NODE 3: LLM Answer (streaming) ────────────────────────────────────
        const model   = OR_FREE[Math.floor(Math.random() * OR_FREE.length)];
        const history = messages.slice(-8, -1).map(m => ({ role: m.role as any, content: m.content }));
        const sysParts = [
          langInstr,
          `[Current Date & Time]\n${nowEN} (Taipei) / ${nowTW}`,
          ragContext ? `[Document Context]\n${ragContext}` : "",
          `[Real-Time Data — verified from external source, use directly]\n${toolContext}`,
          "You are a helpful AI assistant. Output the COMPLETE response with ALL details — never truncate, never omit data. Include ALL source URLs. When writing code meant to be run or previewed (HTML, CSS, JavaScript, React/JSX, SVG, Mermaid diagrams, Python), always wrap it in a fenced code block with the correct language tag: ```html, ```css, ```javascript, ```jsx, ```svg, ```mermaid, ```python. This enables the live Canvas preview.",
        ].filter(Boolean).join("\n\n");

        const finalMsgs = [
          { role: "system" as const, content: sysParts },
          ...history,
          { role: "user" as const, content: userText },
        ];
        onStatus?.(`⚡ [Fast] ${model}…`);
        return this._llmWithFallback(model, finalMsgs, onStatus, onChunk, trackUsage);

      } catch (e: any) {
        if (e?.message?.startsWith("⚠️")) return e.message; // propagate user-visible errors
        // Tool failed — fall through to pure chat
        toolContext = "";
      }
    }

    // ── NODE 3 (chat path, no tool) ───────────────────────────────────────────
    let ragContext2 = "";
    if (this.rag.hasContent()) {
      onStatus?.("📚 [RAG] Retrieving relevant chunks...");
      ragContext2 = this.rag.retrieve(userText);
    }
    const model   = OR_FREE[Math.floor(Math.random() * OR_FREE.length)];
    const history = messages.slice(-8, -1).map(m => ({ role: m.role as any, content: m.content }));
    const sysParts = [
      langInstr,
      `[Current Date & Time]\n${nowEN} (Taipei) / ${nowTW}`,
      ragContext2 ? `[Document Context]\n${ragContext2}` : "",
      "You are a helpful AI assistant. Output the COMPLETE response — never truncate. If you cite any fact, include its source. When writing code meant to be run or previewed (HTML, CSS, JavaScript, React/JSX, SVG, Mermaid diagrams, Python), always use fenced code blocks with language tag: ```html ```css ```javascript ```jsx ```svg ```mermaid ```python — this triggers Canvas live preview.",
    ].filter(Boolean).join("\n\n");

    const finalMsgs = [
      { role: "system" as const, content: sysParts },
      ...history,
      { role: "user" as const, content: userText },
    ];
    onStatus?.(`⚡ [Fast] ${model}…`);
    return this._llmWithFallback(model, finalMsgs, onStatus, onChunk, trackUsage);
  }

  // ── MAIN CHAT ──────────────────────────────────────────────────────────────
  async chat(messages: Message[], onStatus?: (s: string) => void, imageBase64?: string, onChunk?: (chunk: string) => void, forcedTool?: string): Promise<string> {
    if (!this.groqKey && !this.orKey) return "⚠️ No API keys — open Settings.";
    // If only OR key available, auto-use fast mode
    if (!this.groqKey) return this.chatFast(messages, onStatus, imageBase64, onChunk, forcedTool);

    // Reset token counter for this request
    this._tokens = { prompt: 0, completion: 0, total: 0, calls: 0 };
    const trackUsage = (u: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => {
      this._tokens.prompt     += u.prompt_tokens     || 0;
      this._tokens.completion += u.completion_tokens || 0;
      this._tokens.total      += u.total_tokens      || 0;
      this._tokens.calls++;
    };

    const rawText = (messages[messages.length - 1]?.content as string) || "";
    const userText = rawText.trim() || (imageBase64 ? "Please describe and analyze this image in detail." : "Hello");

    // ── Stage 0: Vision ───────────────────────────────────────────────────────
    let enrichedText = userText;
    if (imageBase64) {
      onStatus?.(`👁️ [Vision] ${GROQ_MODELS.vision.split("/").pop()} analyzing image...`);
      const visionMsgs = [{ role: "user", content: [
        { type: "text", text: "Describe this image in full detail for another AI agent." },
        { type: "image_url", image_url: { url: imageBase64 } },
      ]}];
      const desc = await groqFetch(this.groqKey, GROQ_MODELS.vision, visionMsgs as any, 512)
        .catch(() => "Could not analyze image.");
      enrichedText = `[Image: ${desc}]\n\nUser: ${userText}`;
    }

    // ── Stage 1: RAG ──────────────────────────────────────────────────────────
    let ragContext = "";
    if (this.rag.hasContent()) {
      onStatus?.("📚 [RAG] Retrieving relevant document chunks...");
      ragContext = this.rag.retrieve(userText);
    }

    // ── NODE 1: Router — deterministic (no LLM) ──────────────────────────────
    onStatus?.("📋 [Router] Detecting intent...");
    const intents = (forcedTool && forcedTool !== 'auto')
      ? [buildForcedIntent(forcedTool, enrichedText)]
      : routerNode(enrichedText);
    const intent  = intents[0];
    const subtasks: string[] = [enrichedText];
    let toolContext = "";

    // ── NODE 2: Tool Executor ─────────────────────────────────────────────────
    if (intent.type !== 'chat') {
      const toolLabels: Record<string, string> = {
        wiki:"🔍 Wiki", search:"🌐 Search", weather:"⛅ Weather",
        calc:"🧮 Calc", currency:"💱 Currency", url:"📄 URL", image:"🎨 Image", qr:"📱 QR",
        hackernews:"🔥 HN", arxiv:"📐 arXiv", github:"🐙 GitHub",
        define:"📖 Dict", news:"📰 News", ip:"🌍 IP",
        crypto:"🪙 Crypto", stock:"📈 Stock", youtube:"▶️ YouTube",
        browse:"🎭 Browser", screenshot:"📸 Screenshot",
      };
      const label  = toolLabels[intent.type] || intent.type;
      const isImg  = intent.type === 'image';
      onStatus?.(`🛠️ [Tools] ${label}${isImg ? " (may take up to 90s for cold start)" : ""}...`);

      try {
        const result = await runTool(intentToToolCall(intent), this.hfToken, this.mcpUrl, this.pwUrl);

        // Early-exit: image — skip entire swarm
        if (result.startsWith("__IMG__")) {
          const dataUrl   = result.replace(/^__IMG__/, "").replace(/__PROMPT__.+$/, "");
          const imgPrompt = result.match(/__PROMPT__(.+)$/)?.[1] || "generated image";
          onStatus?.("🎨 [Image] Generated successfully!");
          return `**Generated Image** ("${imgPrompt}"):\n\n![${imgPrompt}](${dataUrl})`;
        }
        toolContext = result;
      } catch (e: any) {
        onStatus?.(`⚠️ Tool failed (${e.message}), continuing without tool data`);
      }
    }

    // ── Stage 4: Swarm — OR + Groq + HF 三池並行 (with per-provider timeouts) ──
    const providerCount = 3 + (this.hfToken ? 1 : 0) + (this.clawUrl ? 1 : 0); // OR + Groq + DDG + optional
    const soldierCount = subtasks.length * providerCount;
    onStatus?.(`🐺 [Swarm] ${soldierCount} soldiers racing · 🦆 DDG${this.clawUrl ? " · 🦞 OpenClaw" : ""}...`);

    // Wrap any promise with a timeout — resolves with empty answer on timeout
    const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))]);

    const history = messages.slice(-10, -1).map(m => ({ role: m.role as any, content: m.content }));
    const sysCtx = [
      ragContext   ? `[RAG — Document Context]\n${ragContext}` : "",
      toolContext  ? `[Real-Time Tool Data]\n${toolContext}` : "",
    ].filter(Boolean).join("\n\n");
    const nowTW = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei', dateStyle: 'full', timeStyle: 'medium',
    }).format(new Date());
    const nowEN = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei', dateStyle: 'full', timeStyle: 'medium',
    }).format(new Date());

    const langInstr2 = this.lang === 'zh'
      ? "🔴 MANDATORY LANGUAGE RULE: 你必須且只能使用【繁體中文】回答，嚴禁使用簡體中文。無論資料來源是何種語言，輸出一律為繁體中文。繁體用字：國時體語這為與來說學對從（NOT 国时体语这为与来说学对从）。"
      : "Always respond in English.";
    const soldierSys = [
      langInstr2,  // ← FIRST: language rule gets highest model attention
      `[Current Date & Time]\n${nowEN} (Taipei) / ${nowTW}\nALWAYS use this date. NEVER guess or hallucinate dates.`,
      this.soul    ? `[Identity]\n${this.soul}` : "",
      this.userCtx ? `[User Profile]\n${this.userCtx}` : "",
      sysCtx ? `[Real-Time Data — verified from external sources, use directly, NEVER say you cannot access]\n${sysCtx}` : "",
      `You are a specialist AI soldier in a swarm. Output the COMPLETE, FULL response — never truncate. Include ALL numbers, timestamps, and source URLs. Preserve image/QR markdown verbatim. When writing code (HTML/CSS/JS/JSX/SVG/Mermaid/Python), use fenced code blocks with language tag (e.g. \`\`\`html) to enable Canvas preview.`,
    ].filter(Boolean).join("\n\n");

    type SoldierResult = { task: string; model: string; answer: string; provider: string; error?: string };

    const orJobs = subtasks.map((task, i) => {
      const model = OR_FREE[i % OR_FREE.length];
      const job = orFetch(this.orKey, model, [{ role: "system", content: soldierSys }, ...history, { role: "user", content: task }], 2000, trackUsage)
        .then(answer => ({ task, model, answer, provider: "OR" } as SoldierResult))
        .catch((e: any) => ({ task, model, answer: "", provider: "OR", error: e.message } as SoldierResult));
      return withTimeout(job, 20000, { task, model, answer: "", provider: "OR", error: "timeout" } as SoldierResult);
    });

    const groqJobs = subtasks.map((task, i) => {
      const model = GROQ_MODELS.soldiers[i % GROQ_MODELS.soldiers.length];
      const job = groqFetch(this.groqKey, model, [{ role: "system", content: soldierSys }, ...history, { role: "user", content: task }], 2000, trackUsage)
        .then(answer => ({ task, model, answer, provider: "Groq" } as SoldierResult))
        .catch((e: any) => ({ task, model, answer: "", provider: "Groq", error: e.message } as SoldierResult));
      return withTimeout(job, 20000, { task, model, answer: "", provider: "Groq", error: "timeout" } as SoldierResult);
    });

    const hfJobs: Promise<SoldierResult>[] = this.hfToken ? subtasks.map((task, i) => {
      const model = HF_MODELS[i % HF_MODELS.length];
      const job = hfFetch(this.hfToken, model, [{ role: "system", content: soldierSys }, ...history, { role: "user", content: task }], 2000, trackUsage)
        .then(answer => ({ task, model, answer, provider: "HF" } as SoldierResult))
        .catch((e: any) => ({ task, model, answer: "", provider: "HF", error: e.message } as SoldierResult));
      return withTimeout(job, 25000, { task, model, answer: "", provider: "HF", error: "timeout" } as SoldierResult);
    }) : [];

    // OpenClaw gateway — OpenAI-compatible, treated as extra soldier per subtask
    const clawJobs: Promise<SoldierResult>[] = this.clawUrl ? subtasks.map((task) => {
      const headers: Record<string, string> = this.clawToken
        ? { "Authorization": `Bearer ${this.clawToken}` }
        : {};
      const job = fetchChat(
        `${this.clawUrl}/v1/chat/completions`,
        headers,
        "openclaw", // model name ignored by gateway, required by schema
        [{ role: "system", content: soldierSys }, ...history, { role: "user", content: task }],
      ).then(answer => ({ task, model: "openclaw/gateway", answer, provider: "OpenClaw" } as SoldierResult))
       .catch((e: any) => ({ task, model: "openclaw/gateway", answer: "", provider: "OpenClaw", error: e.message } as SoldierResult));
      return withTimeout(job, 30000, { task, model: "openclaw/gateway", answer: "", provider: "OpenClaw", error: "timeout" } as SoldierResult);
    }) : [];

    // DDG AI Chat soldiers — JS challenge bypass (browser-only)
    const ddgJobs: Promise<SoldierResult>[] = subtasks.map((task, i) => {
      const job = ddgFetch(
        [{ role: "system", content: soldierSys }, { role: "user", content: task }],
        undefined, i,
      ).then(answer => ({ task, model: DDG_MODELS[i % DDG_MODELS.length] ?? "ddg", answer, provider: "DDG" } as SoldierResult))
       .catch((e: any) => ({ task, model: "ddg", answer: "", provider: "DDG", error: e.message } as SoldierResult));
      return withTimeout(job, 25000, { task, model: "ddg", answer: "", provider: "DDG", error: "timeout" } as SoldierResult);
    });

    const allResults = await Promise.all([...orJobs, ...groqJobs, ...hfJobs, ...clawJobs, ...ddgJobs]);
    const valid = allResults.filter(r => r.answer.trim());

    // Show what failed if all empty
    if (!valid.length) {
      const errors = allResults.map(r => `${r.provider}/${r.model.split("/").pop()}: ${r.error || "empty"}`).join(" | ");
      onStatus?.(`⚡ [Fallback] ${errors}`);
      const fallback = await groqFetch(this.groqKey, "llama-3.1-8b-instant", [
        { role: "system", content: `You are a helpful AI assistant. Answer concisely. ${langInstr2}` },
        ...history,
        { role: "user", content: enrichedText },
      ], 1000).catch(() => "");
      if (fallback) return fallback;
      const errSummary = [...new Set(allResults.map(r => r.error))].filter(Boolean).join(", ");
      return `⚠️ All providers failed. Errors: ${errSummary || "unknown"}. Please check your API keys in Settings.`;
    }

    // ── Stage 5: Aggregator ───────────────────────────────────────────────────
    onStatus?.("👑 [Aggregator] groq/compound synthesizing...");

    const report = valid
      .map(r => `### [${r.provider}] ${r.model}\nTask: ${r.task}\n${r.answer}`)
      .join("\n\n---\n\n");

    const aggSys = [
      langInstr2,  // ← FIRST: language rule gets highest model attention
      `[Current Date & Time]\n${nowEN} (Taipei) / ${nowTW}\nALWAYS use this date. NEVER guess or hallucinate dates.`,
      this.soul    ? `[Identity]\n${this.soul}` : "",
      this.userCtx ? `[User Profile]\n${this.userCtx}` : "",
      `You are the senior aggregator AI. Merge all specialist soldier reports into one comprehensive, complete Markdown response. Rules: (1) Output EVERYTHING — never truncate or omit data. (2) Include ALL source URLs so the user can verify every fact. (3) Show exact numbers, prices, timestamps as provided. (4) Preserve all image/QR markdown verbatim. (5) Never say "I cannot access" — all data is already provided above. (6) Structure clearly with headers, but include every detail.`,
    ].filter(Boolean).join("\n\n");

    const aggMsgs = [
      { role: "system" as const, content: aggSys },
      { role: "user"   as const, content: `Original request: ${enrichedText}\n\n${toolContext ? `Tool results:\n${toolContext}\n\n` : ""}Reports:\n\n${report}` },
    ];

    // ── Stream aggregator if onChunk provided, else buffered ─────────────────
    let finalAnswer = "";
    if (onChunk) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.groqKey}` },
          body: JSON.stringify({ model: GROQ_MODELS.aggregator, messages: aggMsgs, max_tokens: 4096, stream: true }),
        });
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let ptok = 0, ctok = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of dec.decode(value).split("\n")) {
              if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
              try {
                const d = JSON.parse(line.slice(6));
                const tok = d.choices?.[0]?.delta?.content;
                if (tok) { finalAnswer += tok; onChunk(tok); }
                if (d.usage) { ptok = d.usage.prompt_tokens ?? 0; ctok = d.usage.completion_tokens ?? 0; }
              } catch { /* ignore SSE parse errors */ }
            }
          }
          if (ptok || ctok) trackUsage({ prompt_tokens: ptok, completion_tokens: ctok, total_tokens: ptok + ctok });
          // If stream returned 200 but no SSE content (model doesn't support streaming),
          // fall back to buffered fetch so finalAnswer is never empty
          if (!finalAnswer) {
            finalAnswer = await groqFetch(this.groqKey, GROQ_MODELS.aggregator, aggMsgs, 4096, trackUsage);
            onChunk(finalAnswer);
          }
        } else {
          finalAnswer = await groqFetch(this.groqKey, GROQ_MODELS.aggregator, aggMsgs, 4096, trackUsage);
          onChunk(finalAnswer);
        }
      } catch {
        finalAnswer = valid[0].answer;
        onChunk(finalAnswer);
      }
    } else {
      finalAnswer = await groqFetch(this.groqKey, GROQ_MODELS.aggregator, aggMsgs, 4096, trackUsage)
        .catch(() => valid[0].answer);
    }

    return finalAnswer;
  }
}
