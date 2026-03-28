export type Lang = 'en' | 'zh';

export interface Locale {
  title: string;
  tagline: string;
  taglineFast: string;
  subtitle: string;
  subtitleFast: string;
  placeholder: string;
  hint: string;
  connected: string;
  setup: string;
  listen: string;
  stop: string;
  aiLabel: string;
  transcribing: string;
  start: string;
  configTitle: string;
  configEyebrow: string;
  keyOR: string;
  keyGroq: string;
  keyHF: string;
  keyClaw: string;
  keyClawToken: string;
  keyMCP: string;
  keyNote: string;
  suggestions: { tag: string; text: string }[];
}

export const I18N: Record<Lang, Locale> = {
  en: {
    title: 'Universal AI',
    tagline: '⚡ Swarm Intelligence · 3 Providers · 20+ Free Models',
    taglineFast: '⚡ Fast Mode · Single Model · ~1K Tokens',
    subtitle: 'Groq · OpenRouter · HuggingFace running in parallel.\nText, images, voice, documents, web search, image generation & 15+ tools.',
    subtitleFast: '⚡ Fast Mode: single model + auto tools (search, weather, crypto…). ~80% fewer tokens than Swarm.\nSwitch to Swarm for deeper multi-model analysis.',
    placeholder: 'Ask anything…',
    hint: 'Shift+Enter for new line',
    connected: '● Connected',
    setup: '○ Setup required',
    listen: 'Listen',
    stop: 'Stop',
    aiLabel: 'AI Response',
    transcribing: 'Transcribing audio…',
    start: 'Start chatting →',
    configTitle: 'Connect your API keys',
    configEyebrow: 'Configuration',
    keyOR: 'OpenRouter API Key',
    keyGroq: 'Groq API Key',
    keyHF: 'Hugging Face Token (optional — enables image generation)',
    keyClaw: 'OpenClaw Gateway URL (optional — cloud AI agent)',
    keyClawToken: 'OpenClaw Token (optional)',
    keyMCP: 'MCP Server URL (optional — Model Context Protocol)',
    keyNote: 'All keys are stored locally in your browser and never sent to any third-party server.\nGet free keys at: openrouter.ai · console.groq.com · huggingface.co',
    suggestions: [
      { tag: '🌐 Search',  text: 'What are the latest AI breakthroughs in 2026?' },
      { tag: '🎨 Image',   text: 'Generate an image of a futuristic city at night' },
      { tag: '⛅ Weather', text: "What's the weather in Tokyo right now?" },
      { tag: '💱 Finance', text: 'Convert $500 USD to TWD and EUR' },
    ],
  },
  zh: {
    title: 'Universal AI',
    tagline: '⚡ 蜂群智慧 · 3 個供應商 · 20+ 免費模型',
    taglineFast: '⚡ Fast 模式 · 單一模型 · 省 ~85% Token',
    subtitle: 'Groq · OpenRouter · HuggingFace 並行運算。\n支援文字、圖片、語音、文件、網頁搜尋、圖片生成等 15+ 工具。',
    subtitleFast: '⚡ Fast 模式：單一模型 + 自動工具（搜尋、天氣、幣價…）。比 Swarm 省約 80% Token。\n切換 Swarm 可啟用深度多模型分析。',
    placeholder: '輸入訊息…',
    hint: 'Shift+Enter 換行',
    connected: '● 已連接',
    setup: '○ 請先設定 API Key',
    listen: '播放',
    stop: '停止',
    aiLabel: 'AI 回應',
    transcribing: '語音轉文字中…',
    start: '開始使用 →',
    configTitle: '連接 API 金鑰',
    configEyebrow: '設定',
    keyOR: 'OpenRouter API Key',
    keyGroq: 'Groq API Key',
    keyHF: 'Hugging Face Token（選填，啟用圖片生成）',
    keyClaw: 'OpenClaw Gateway URL（選填，雲端 AI 智能體）',
    keyClawToken: 'OpenClaw Token（選填）',
    keyMCP: 'MCP Server URL（選填，Model Context Protocol）',
    keyNote: '所有金鑰僅儲存於瀏覽器本地，不會傳送至任何第三方伺服器。\n免費取得：openrouter.ai · console.groq.com · huggingface.co',
    suggestions: [
      { tag: '🌐 搜尋',  text: '2026 年最新的 AI 突破有哪些？' },
      { tag: '🎨 生圖',  text: '生成一張未來城市的夜景圖' },
      { tag: '⛅ 天氣',  text: '東京現在的天氣如何？' },
      { tag: '💱 匯率',  text: '500 美元換算成台幣和歐元是多少？' },
    ],
  },
};
