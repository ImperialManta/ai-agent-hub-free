import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, Mic, Paperclip, X, Volume2, StopCircle, Square, Download, Zap, Users } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.mjs`;
import { AiAgentService } from './services/ai';
import type { Message, TokenUsage } from './services/ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { THEMES, type ThemeKey } from './theme';
import { I18N, type Lang } from './i18n';

// ── Canvas helpers (module-level) ─────────────────────────────────────────────

// Extract first renderable code block from markdown
function extractCanvas(text: string): { code: string; lang: string } | null {
  const match = text.match(/```(html|css|javascript|js|jsx|tsx|react|svg|mermaid|python|py)\s*\n([\s\S]*?)```/i);
  if (!match) return null;
  const raw  = match[1].toLowerCase();
  const lang = raw === 'py' ? 'python' : raw;
  const code = match[2].trim();
  return { code, lang };
}

// Build iframe srcdoc for preview
function buildPreview(code: string, lang: string): string {
  const base = `*{box-sizing:border-box}body{margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#111}`;
  if (lang === 'html') return code;
  if (lang === 'svg') return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5">${code}</body></html>`;
  if (lang === 'css') return `<!DOCTYPE html><html><head><style>${base}${code}</style></head><body><h2>CSS Preview</h2><p>This is a paragraph.</p><button>Button</button><ul><li>Item 1</li><li>Item 2</li></ul></body></html>`;
  if (lang === 'javascript' || lang === 'js') {
    return `<!DOCTYPE html><html><head><style>body{margin:0;padding:16px;font-family:monospace;font-size:14px;background:#1a1a1a;color:#e0e0e0}pre{white-space:pre-wrap;word-break:break-all}.err{color:#f87171}</style></head><body><pre id="out"></pre><script>
const _out=document.getElementById('out');
const _log=(...a)=>{_out.textContent+=a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\\n'};
const _err=(e)=>{_out.innerHTML+='<span class="err">Error: '+e.message+'</span>\\n'};
const console={log:_log,warn:_log,error:_log,info:_log,dir:_log,table:_log};
try{${code}}catch(e){_err(e)}
<\/script></body></html>`;
  }
  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
    return `<!DOCTYPE html><html><head>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<style>*{box-sizing:border-box}body{margin:0;padding:16px;font-family:system-ui,sans-serif}</style>
</head><body><div id="root"></div>
<script type="text/babel">
${code}
const _root=ReactDOM.createRoot(document.getElementById('root'));
const _C=typeof App!=='undefined'?App:typeof default_1!=='undefined'?default_1:()=>React.createElement('p',null,'No App component found — make sure to define a component named App');
_root.render(React.createElement(_C));
<\/script></body></html>`;
  }
  if (lang === 'mermaid') {
    return `<!DOCTYPE html><html><head>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#fff;display:flex;justify-content:center;align-items:flex-start;min-height:100vh}.mermaid{max-width:100%}</style>
</head><body>
<div class="mermaid">${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
<script>mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose'})<\/script>
</body></html>`;
  }
  if (lang === 'python') {
    const escaped = code.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
    return `<!DOCTYPE html><html><head>
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"><\/script>
<style>*{box-sizing:border-box}body{margin:0;padding:16px;font-family:monospace;font-size:13px;background:#1a1a1a;color:#e0e0e0}
#run{cursor:pointer;padding:7px 18px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;margin-bottom:12px}
#run:disabled{opacity:.5;cursor:not-allowed}
#out{white-space:pre-wrap;word-break:break-all;line-height:1.6}.err{color:#f87171}</style>
</head><body>
<button id="run">▶ Run Python</button>
<pre id="out">Click ▶ Run Python to execute...</pre>
<script>
const _code=\`${escaped}\`;
let pyodide=null;
document.getElementById('run').onclick=async()=>{
  const btn=document.getElementById('run'),out=document.getElementById('out');
  btn.disabled=true; btn.textContent='⏳ Loading Python (~5s first run)...'; out.textContent='';
  if(!pyodide){ try{ pyodide=await loadPyodide(); }catch(e){ out.innerHTML='<span class="err">Failed to load Pyodide: '+e+'</span>'; btn.disabled=false; btn.textContent='▶ Run Python'; return; } }
  btn.textContent='▶ Run Python'; btn.disabled=false;
  let outbuf='';
  pyodide.setStdout({batched:s=>{outbuf+=s+'\\n';out.textContent=outbuf;}});
  pyodide.setStderr({batched:s=>{outbuf+='[stderr] '+s+'\\n';out.innerHTML=outbuf.replace(/\\[stderr\\][^\\n]+/g,m=>'<span class="err">'+m+'</span>');}});
  try{ await pyodide.runPythonAsync(_code); if(!outbuf) out.textContent='(no output)'; }
  catch(e){ out.innerHTML+='<span class="err">\\nError: '+e.message+'</span>'; }
};
<\/script></body></html>`;
  }
  return `<!DOCTYPE html><html><body><pre style="padding:16px;font-family:monospace;white-space:pre-wrap">${code.replace(/</g, '&lt;')}</pre></body></html>`;
}

// ── Typing indicator ──────────────────────────────────────────────────────────
const Typing = ({ status, accent }: { status: string; accent: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
    <div style={{ display: 'flex', gap: 6 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 8, height: 8, background: accent, borderRadius: '50%', animation: `bounce 1.2s ${i*0.2}s infinite ease-in-out` }}/>
      ))}
    </div>
    <span style={{ fontSize: 13, color: accent, fontWeight: 600 }}>{status}</span>
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
const _initLang = (localStorage.getItem('lang') as any) || 'zh';
const svc = new AiAgentService();
svc.setLang(_initLang);

export default function App() {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [groqKey, setGroqKey]       = useState(localStorage.getItem('groq_key')   || '');
  const [orKey, setOrKey]           = useState(localStorage.getItem('or_key')     || '');
  const [hfToken, setHfToken]       = useState(localStorage.getItem('hf_token')   || '');
  const [clawUrl, setClawUrl]       = useState(localStorage.getItem('claw_url')   || '');
  const [clawToken, setClawToken]   = useState(localStorage.getItem('claw_token') || '');
  const [mcpUrl, setMcpUrl]         = useState(localStorage.getItem('mcp_url')    || '');
  const [fastMode, setFastMode]     = useState(localStorage.getItem('fast_mode') === '1');

  const hasAnyKey = !!groqKey || !!orKey;
  const [showSettings, setShowSettings] = useState(!hasAnyKey);

  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState('');
  const [previewImage, setPreviewImage]   = useState<string | null>(null);
  const [speakingIdx, setSpeakingIdx]     = useState<number | null>(null);
  const [docName, setDocName]             = useState<string | null>(null);
  const [recording, setRecording]         = useState(false);
  const [ttsError, setTtsError]           = useState('');
  const [lastTokens, setLastTokens]       = useState<TokenUsage | null>(null);
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({ prompt: 0, completion: 0, total: 0, calls: 0 });
  const [theme, setTheme]                 = useState<ThemeKey>(() => {
    const s = localStorage.getItem('theme') as ThemeKey;
    return (s === 'dark' || s === 'purple') ? s : 'dark';
  });
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'zh');

  // ── Key test state ────────────────────────────────────────────────────────
  const [keyTestStatus, setKeyTestStatus] = useState<'idle'|'testing'|'ok'|'ratelimit'|'invalid'>('idle');

  // ── Tool selector state ───────────────────────────────────────────────────
  const [selectedTool, setSelectedTool] = useState<string>('auto');
  const [toolsExpanded, setToolsExpanded] = useState(false);

  // ── Canvas state ─────────────────────────────────────────────────────────
  const [canvas, setCanvas]           = useState<{ code: string; lang: string } | null>(null);
  const [canvasTab, setCanvasTab]     = useState<'preview' | 'code'>('preview');
  const [canvasCopied, setCanvasCopied] = useState(false);
  const [canvasFull, setCanvasFull]   = useState(false);

  const T    = THEMES[theme];
  const i    = I18N[lang];
  const isDark = theme === 'dark';

  const bottomRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    svc.updateKeys(groqKey, orKey, hfToken, clawUrl, clawToken, mcpUrl);
    localStorage.setItem('groq_key',   groqKey);
    localStorage.setItem('or_key',     orKey);
    localStorage.setItem('hf_token',   hfToken);
    localStorage.setItem('claw_url',   clawUrl);
    localStorage.setItem('claw_token', clawToken);
    localStorage.setItem('mcp_url',    mcpUrl);
  }, [groqKey, orKey, hfToken, clawUrl, clawToken, mcpUrl]);

  useEffect(() => { localStorage.setItem('fast_mode', fastMode ? '1' : '0'); }, [fastMode]);
  useEffect(() => { localStorage.setItem('theme', theme); document.body.style.background = T.bg; }, [theme, T.bg]);
  useEffect(() => { localStorage.setItem('lang', lang); svc.setLang(lang); }, [lang]);

  useEffect(() => {
    if (!showSettings) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && hasAnyKey) setShowSettings(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showSettings, hasAnyKey]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // ── Auto-detect canvas from completed AI messages ─────────────────────────
  useEffect(() => {
    if (loading) return;
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant' || !last.content) return;
    const c = extractCanvas(last.content);
    if (c) { setCanvas(c); setCanvasTab('preview'); setCanvasFull(false); }
  }, [messages, loading]);

  // Pre-process document text: strip repeated whitespace, truncate to ~15K words
  const preprocessDoc = (text: string): string => {
    const cleaned = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const words = cleaned.split(/\s+/);
    if (words.length > 15000) {
      return words.slice(0, 15000).join(' ') + `\n\n[...document truncated at 15,000 words to save tokens]`;
    }
    return cleaned;
  };

  // ── File handler ─────────────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = ev => setPreviewImage(ev.target?.result as string);
      r.readAsDataURL(file);
    } else if (file.type.startsWith('audio/')) {
      doTranscribe(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setStatus('📄 Extracting PDF…');
      try {
        const buf = await file.arrayBuffer();
        const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
        let text = `[PDF: ${file.name} — ${pdf.numPages} pages]\n\n`;
        for (let p = 1; p <= Math.min(pdf.numPages, 50); p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          text += `--- Page ${p} ---\n` + (content.items as any[]).map((it: any) => it.str).join(' ') + '\n\n';
        }
        svc.addDocument(preprocessDoc(text), file.name);
        setDocName(file.name);
      } catch (err: any) {
        setStatus(`PDF parse failed: ${err.message}`);
      } finally { setStatus(''); }
    } else {
      const r = new FileReader();
      r.onload = ev => { svc.addDocument(preprocessDoc(ev.target?.result as string), file.name); setDocName(file.name); };
      r.readAsText(file);
    }
  };

  const doTranscribe = async (file: File) => {
    if (!groqKey) { setStatus('⚠️ Groq key needed for voice transcription'); setTimeout(() => setStatus(''), 3000); return; }
    setLoading(true); setStatus(i.transcribing);
    const text = await svc.transcribe(file);
    setInput(text); setLoading(false); setStatus('');
  };

  // ── Mic — fixed: recorderRef allows early stop ────────────────────────────
  const handleMic = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!groqKey) { setTtsError('Groq key needed for voice input'); setTimeout(() => setTtsError(''), 3000); return; }
    try {
      setRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        recorderRef.current = null;
        setRecording(false);
        await doTranscribe(new File([new Blob(chunks, { type: 'audio/webm' })], 'rec.webm', { type: 'audio/webm' }));
      };
      rec.start();
      setTimeout(() => { if (recorderRef.current === rec) rec.stop(); }, 60000);
    } catch {
      setRecording(false);
      recorderRef.current = null;
    }
  };

  // ── TTS — Groq Orpheus 優先，失敗自動降級到瀏覽器 Web Speech ─────────────
  const handleSpeak = async (text: string, idx: number) => {
    // 停止中 → 停止
    if (speakingIdx === idx) {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setSpeakingIdx(null);
      return;
    }
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeakingIdx(idx);

    const plainText = text.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~]/g, '').slice(0, 1500);

    // 嘗試 Groq Orpheus TTS（需要 Groq key + 已接受條款）
    if (groqKey) {
      try {
        const buf = await svc.tts(plainText);
        const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
        const audio = new Audio(url); audioRef.current = audio;
        audio.onended = () => { setSpeakingIdx(null); URL.revokeObjectURL(url); };
        audio.play();
        return;
      } catch (e: any) {
        // 條款未接受 → 靜默降級到 Web Speech
        if (!e?.message?.includes('terms') && !e?.message?.includes('400')) {
          setSpeakingIdx(null);
          setTtsError(e?.message || 'TTS failed');
          setTimeout(() => setTtsError(''), 4000);
          return;
        }
      }
    }

    // Fallback：瀏覽器內建 Web Speech API（免費，不需要 key）
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(plainText);
      utter.lang = lang === 'zh' ? 'zh-TW' : 'en-US';
      utter.rate = 1.0;
      utter.onend  = () => setSpeakingIdx(null);
      utter.onerror = () => setSpeakingIdx(null);
      window.speechSynthesis.speak(utter);
    } else {
      setSpeakingIdx(null);
      setTtsError(lang === 'zh' ? '此瀏覽器不支援語音播放' : 'TTS not supported in this browser');
      setTimeout(() => setTtsError(''), 3000);
    }
  };

  // ── Test OR key ───────────────────────────────────────────────────────────
  const testOrKey = async (key: string) => {
    if (!key) return;
    setKeyTestStatus('testing');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct:free',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      });
      if (res.status === 429) { setKeyTestStatus('ratelimit'); return; }
      if (res.status === 401 || res.status === 403) { setKeyTestStatus('invalid'); return; }
      setKeyTestStatus('ok');
    } catch {
      setKeyTestStatus('invalid');
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!canSend) return;
    const fallbackText = lang === 'zh' ? '請描述這張圖片' : 'Please describe this image';
    const msgContent = input.trim() || (previewImage ? fallbackText : '');
    setMessages(prev => [...prev, { role: 'user', content: previewImage ? `${msgContent}\n\n![uploaded](${previewImage})` : msgContent }]);
    setInput('');
    const imgSnap = previewImage; setPreviewImage(null);
    setLoading(true); setStatus('Initializing…');
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    let streamed = '';

    const chatFn = fastMode ? svc.chatFast.bind(svc) : svc.chat.bind(svc);
    const toolForThisSend = selectedTool;
    setSelectedTool('auto');

    try {
      const reply = await chatFn(
        [...messages, { role: 'user', content: msgContent }],
        s => setStatus(s),
        imgSnap || undefined,
        chunk => {
          streamed += chunk;
          setMessages(prev => {
            const u = [...prev];
            u[u.length - 1] = { role: 'assistant', content: streamed };
            return u;
          });
        },
        toolForThisSend
      );
      const tok = svc.lastTokens;
      setLastTokens(tok);
      setSessionTokens(prev => ({
        prompt:     prev.prompt     + tok.prompt,
        completion: prev.completion + tok.completion,
        total:      prev.total      + tok.total,
        calls:      prev.calls      + tok.calls,
      }));
      setMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: 'assistant', content: reply };
        return u;
      });
    } catch (e: any) {
      setMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: 'assistant', content: `**Error:** ${e?.message || e}` };
        return u;
      });
    } finally { setLoading(false); setStatus(''); }
  };

  const canSend = !!(input.trim() || previewImage) && !loading && hasAnyKey;

  const iconBtn: React.CSSProperties = {
    background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
    color: T.text3, padding: '7px 9px', display: 'flex', alignItems: 'center', borderRadius: T.radius,
  };

  // ── Mode toggle styles ────────────────────────────────────────────────────
  const modeBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 12, fontWeight: 700,
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accent : 'none',
    color: active ? T.accentFg : T.text3,
    cursor: 'pointer', borderRadius: T.radius, transition: 'all .15s',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background: T.bg, color: T.text, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;background:${T.bg}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
        textarea{background:none;border:none;outline:none;resize:none;color:${T.text};font-size:15px;line-height:1.6;padding:6px 4px;min-height:32px;max-height:160px;font-family:inherit;flex:1}
        textarea::placeholder{color:${T.text3}}
        .ihover:hover{border-color:${T.accent}!important;color:${T.accent}!important}
        .sbtn{background:${T.bg2};border:1px solid ${T.border};padding:14px 16px;font-size:14px;color:${T.text2};cursor:pointer;text-align:left;border-radius:${T.radius};display:flex;flex-direction:column;gap:6px;transition:border-color .15s,color .15s}
        .sbtn:hover{border-color:${T.accent};color:${T.text}}
        .ibx:focus-within{border-color:${T.accent}!important}
        .finput:focus{border-color:${T.accent}!important;outline:none}
        .bubble-ai{max-width:92%;font-size:15px;line-height:1.8;color:${T.text2}}
        .bubble-ai p{margin:0 0 12px}.bubble-ai p:last-child{margin-bottom:0}
        .bubble-ai h1,.bubble-ai h2,.bubble-ai h3{color:${T.text};margin:20px 0 10px;font-weight:700}
        .bubble-ai h1{font-size:20px;border-bottom:2px solid ${T.accent};padding-bottom:5px}
        .bubble-ai h2{font-size:17px}.bubble-ai h3{font-size:15px;color:${T.accent}}
        .bubble-ai ul,.bubble-ai ol{padding-left:22px;margin:10px 0}
        .bubble-ai li{margin:6px 0}
        .bubble-ai pre{background:${T.bg2};border:1px solid ${T.border};border-left:3px solid ${T.accent};padding:16px;overflow-x:auto;margin:14px 0;font-size:13px;border-radius:${T.radius}}
        .bubble-ai code{font-family:'Fira Code',monospace;font-size:13px}
        .bubble-ai :not(pre)>code{background:${T.bg2};border:1px solid ${T.border};padding:2px 7px;color:${T.accent};border-radius:4px}
        .bubble-ai img{max-width:100%;margin:12px 0;display:block;border:1px solid ${T.border};border-radius:${T.radius}}
        .bubble-ai table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}
        .bubble-ai th,.bubble-ai td{border:1px solid ${T.border};padding:10px 14px}
        .bubble-ai th{background:${T.bg2};color:${T.accent};font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
        .bubble-ai blockquote{border-left:3px solid ${T.accent};padding-left:16px;color:${T.text3};margin:12px 0}
        .bubble-ai a{color:${T.accent};text-decoration:none}.bubble-ai a:hover{text-decoration:underline}
        .bubble-ai strong{color:${T.text}}
        .msg{margin-bottom:28px;animation:fadein .2s ease}
        .spkbtn{display:flex;align-items:center;gap:5px;background:none;border:1px solid ${T.border};cursor:pointer;color:${T.text3};padding:5px 10px;font-size:12px;font-weight:600;border-radius:${T.radius};transition:border-color .15s,color .15s}
        .spkbtn:hover,.spkbtn.on{border-color:${T.accent};color:${T.accent}}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .rec-pulse{animation:recpulse 1s infinite}
        @keyframes recpulse{0%,100%{opacity:1}50%{opacity:.4}}
        @media(max-width:640px){
          .header-right{gap:4px!important;flex-wrap:nowrap;overflow-x:auto}
          .mode-toggle{display:none!important}
          .bubble-ai{font-size:14px!important}
          .bubble-ai pre{font-size:12px!important;padding:10px!important}
          .msg{margin-bottom:18px!important}
          .sbtn{padding:10px 12px!important;font-size:13px!important}
          .canvas-panel{position:fixed!important;inset:0!important;width:100%!important;z-index:40!important}
          .chat-inner{padding:0 14px!important}
          .input-wrap{padding:8px 14px 16px!important}
          .grid-suggest{grid-template-columns:1fr!important}
          .user-bubble{max-width:88%!important}
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', height:56, background: T.bg, borderBottom:`2px solid ${T.headerBorder}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ background: T.accent, color: T.accentFg, fontSize:11, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', padding:'3px 9px', borderRadius: T.radius }}>⚡ Live</span>
          <span style={{ fontSize:16, fontWeight:800, color: T.text, letterSpacing: isDark?'.06em':'-.01em', textTransform: isDark?'uppercase':'none' }}>{i.title}</span>
        </div>

        <div className="header-right" style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Fast / Swarm mode toggle */}
          <div className="mode-toggle" style={{ display:'flex', gap:2, background: T.bg2, border:`1px solid ${T.border}`, borderRadius: T.radius, padding:2 }}>
            <button style={modeBtn(!fastMode)} onClick={() => setFastMode(false)} title="Swarm: multiple models, higher quality">
              <Users size={12}/> Swarm
            </button>
            <button style={modeBtn(fastMode)} onClick={() => setFastMode(true)} title="Fast: single model, saves tokens">
              <Zap size={12}/> Fast
            </button>
          </div>

          {/* Theme dots */}
          <div style={{ display:'flex', gap:6, alignItems:'center', marginLeft:4 }}>
            {(['dark','purple'] as ThemeKey[]).map(k => (
              <button key={k} onClick={() => setTheme(k)} title={THEMES[k].label}
                style={{ width:16, height:16, borderRadius:'50%', background: THEMES[k].dot, cursor:'pointer', border: theme===k ? `3px solid ${T.text}` : '2px solid transparent', padding:0, flexShrink:0 }}/>
            ))}
          </div>

          {/* Lang toggle */}
          <button onClick={() => setLang(lang==='en'?'zh':'en')} style={{ ...iconBtn, fontSize:12, fontWeight:700, padding:'5px 10px' }} className="ihover">
            {lang==='en' ? '中文' : 'EN'}
          </button>

          {/* Export */}
          {messages.length > 0 && (
            <button style={iconBtn} className="ihover" title="Export conversation" onClick={() => {
              const md = messages.map(m => `**${m.role==='user'?'👤 You':'🤖 AI'}**\n\n${m.content}`).join('\n\n---\n\n');
              const blob = new Blob([`# Universal AI — Conversation\n\n${md}`], { type: 'text/markdown' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `chat-${new Date().toISOString().slice(0,10)}.md`; a.click();
            }}><Download size={15}/></button>
          )}

          {/* Doc badge */}
          {docName && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background: T.bg2, border:`1px solid ${T.accent}`, padding:'4px 10px', fontSize:12, color: T.accent, fontWeight:700, borderRadius: T.radius }}>
              📄 {docName}
              <button onClick={() => { svc.clearRAG(); setDocName(null); }}
                style={{ background:'none', border:'none', cursor:'pointer', color: T.accent, display:'flex', padding:0, marginLeft:2 }}>
                <X size={11}/>
              </button>
            </div>
          )}

          <button style={iconBtn} className="ihover" onClick={() => setShowSettings(true)}><Settings size={15}/></button>
        </div>
      </header>

      {/* ── Middle: chat + canvas ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Chat column — hidden when canvas is fullscreen */}
        {!canvasFull && (
          <div style={{ flex:1, overflowY:'auto', padding:'36px 0', minWidth:0 }}>
            <div className="chat-inner" style={{ maxWidth:800, margin:'0 auto', padding:'0 28px' }}>

              {messages.length === 0 && (
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', minHeight:'68vh', gap:32 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, letterSpacing:'.12em', color: T.accent, textTransform:'uppercase', marginBottom:14 }}>
                      {fastMode ? i.taglineFast : i.tagline}
                    </div>
                    <div style={{ fontSize: isDark?38:32, fontWeight:800, lineHeight:1.1, color: T.text, letterSpacing:'-.02em' }}>
                      {lang==='zh'
                        ? <>有什麼可以 <span style={{color:T.accent}}>幫忙</span> 的？</>
                        : <>What can <span style={{color:T.accent}}>I help</span> you with?</>}
                    </div>
                  </div>
                  <div style={{ fontSize:15, color: T.text3, lineHeight:1.8, maxWidth:500, borderLeft:`3px solid ${T.border}`, paddingLeft:16, whiteSpace:'pre-line' }}>
                    {fastMode ? i.subtitleFast : i.subtitle}
                  </div>
                  <div className="grid-suggest" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, maxWidth:640 }}>
                    {i.suggestions.map(s => (
                      <button key={s.text} className="sbtn" onClick={() => setInput(s.text)}>
                        <span style={{ fontSize:11, fontWeight:700, color: T.accent }}>{s.tag}</span>
                        <span>{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <div key={idx} className="msg" style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start' }}>
                  {m.role === 'user' ? (
                    <div className="user-bubble" style={{ background: isDark?'#000':T.bg2, border:`1px solid ${isDark?T.accent:T.border}`, padding:'12px 18px', maxWidth:'72%', fontSize:15, lineHeight:1.6, color: T.text, borderRadius: T.radius }}>
                      {(() => {
                        const img = m.content.match(/!\[uploaded\]\((data:[^)]{1,2000000})\)/);
                        const txt = m.content.replace(/\n\n!\[uploaded\]\(data:[^)]+\)/,'').trim();
                        return (<>{txt && <span>{txt}</span>}{img && <img src={img[1]} alt="uploaded" style={{ maxWidth:'100%', marginTop: txt?10:0, display:'block', borderRadius: T.radius }}/>}</>);
                      })()}
                    </div>
                  ) : (
                    <div style={{ maxWidth:'100%' }}>
                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.1em', color: T.accent, textTransform:'uppercase', marginBottom:8 }}>{i.aiLabel}</div>
                      <div className="bubble-ai">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          urlTransform={(url: string) => url}
                          components={{ img: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} style={{ maxWidth:'100%', borderRadius: T.radius, display:'block', margin:'12px 0' }}/> }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <button className={`spkbtn ${speakingIdx===idx?'on':''}`} onClick={() => handleSpeak(m.content, idx)}>
                          {speakingIdx===idx ? <><StopCircle size={13}/> {i.stop}</> : <><Volume2 size={13}/> {i.listen}</>}
                        </button>
                      </div>
                      {/* Artifact card — shown when message contains renderable code */}
                      {(() => {
                        const art = extractCanvas(m.content);
                        if (!art) return null;
                        const langLabel: Record<string,string> = { html:'HTML', css:'CSS', javascript:'JavaScript', js:'JavaScript', jsx:'React JSX', tsx:'React TSX', react:'React', svg:'SVG', mermaid:'Mermaid Diagram', python:'Python' };
                        const isActive = canvas?.code === art.code;
                        return (
                          <div
                            onClick={() => { setCanvas(art); setCanvasTab('preview'); setCanvasFull(false); }}
                            style={{
                              marginTop:12, display:'flex', alignItems:'center', gap:12,
                              background: T.bg2, border:`1px solid ${isActive ? T.accent : T.border}`,
                              borderRadius: T.radius, padding:'10px 14px', cursor:'pointer',
                              transition:'border-color .15s', maxWidth:360,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = T.accent)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = isActive ? T.accent : T.border)}
                          >
                            <div style={{ width:36, height:36, background: isDark ? '#111' : T.bg3, border:`1px solid ${T.border}`, borderRadius: T.radius, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>
                              {'</>'}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color: T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                {art.lang === 'html' ? 'HTML Preview' : art.lang === 'css' ? 'CSS Styles' : art.lang === 'svg' ? 'SVG Graphic' : 'Code · ' + (langLabel[art.lang] || art.lang.toUpperCase())}
                              </div>
                              <div style={{ fontSize:11, color: T.text3, marginTop:2 }}>Code · {langLabel[art.lang] || art.lang.toUpperCase()}</div>
                            </div>
                            <div style={{ fontSize:12, fontWeight:700, color: T.accent, background: isDark ? 'rgba(255,184,0,.12)' : 'rgba(124,58,237,.1)', padding:'5px 12px', borderRadius: T.radius, flexShrink:0 }}>
                              {isActive ? '● Open' : '▶ Open'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}

              {loading && <Typing status={status} accent={T.accent}/>}
              <div ref={bottomRef}/>
            </div>
          </div>
        )}

        {/* Canvas panel */}
        {canvas && (
          <div className="canvas-panel" style={{
            flexShrink: 0,
            width: canvasFull ? '100%' : '50%',
            borderLeft: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            background: T.bg2,
            height: '100%',
          }}>
            {/* Canvas Header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:`1px solid ${T.border}`, flexShrink:0, background: T.bg }}>
              <span style={{ fontSize:12, fontWeight:700, color: T.accent, textTransform:'uppercase', letterSpacing:'.08em' }}>
                {({'html':'HTML','css':'CSS','javascript':'JavaScript','js':'JavaScript','jsx':'React JSX','tsx':'React TSX','react':'React','svg':'SVG','mermaid':'Mermaid Diagram','python':'Python'} as Record<string,string>)[canvas.lang] || canvas.lang.toUpperCase()}
              </span>
              <div style={{ flex:1 }}/>
              {/* Preview / Code tabs */}
              {(['preview','code'] as const).map(tab => (
                <button key={tab} onClick={() => setCanvasTab(tab)}
                  style={{ padding:'4px 12px', fontSize:12, fontWeight:700, border:`1px solid ${canvasTab===tab ? T.accent : T.border}`, background: canvasTab===tab ? T.accent : 'none', color: canvasTab===tab ? T.accentFg : T.text3, borderRadius: T.radius, cursor:'pointer' }}>
                  {tab === 'preview' ? '▶ Preview' : '<> Code'}
                </button>
              ))}
              {/* Copy button */}
              <button onClick={() => { navigator.clipboard.writeText(canvas.code); setCanvasCopied(true); setTimeout(()=>setCanvasCopied(false),2000); }}
                style={{ padding:'4px 10px', fontSize:12, fontWeight:700, border:`1px solid ${T.border}`, background:'none', color: canvasCopied ? T.accent : T.text3, borderRadius: T.radius, cursor:'pointer' }}>
                {canvasCopied ? '✓ Copied' : 'Copy'}
              </button>
              {/* Download button */}
              <button onClick={() => {
                const extMap: Record<string,string> = { html:'html', css:'css', jsx:'jsx', tsx:'tsx', react:'jsx', svg:'svg', mermaid:'mmd', python:'py', py:'py', javascript:'js', js:'js' };
                const ext = extMap[canvas.lang] || 'txt';
                const blob = new Blob([canvas.code], { type: 'text/plain' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `canvas.${ext}`; a.click();
              }} style={{ padding:'4px 10px', fontSize:12, fontWeight:700, border:`1px solid ${T.border}`, background:'none', color: T.text3, borderRadius: T.radius, cursor:'pointer' }}>
                ↓
              </button>
              {/* Fullscreen toggle */}
              <button onClick={() => setCanvasFull(f => !f)}
                style={{ padding:'4px 8px', fontSize:12, border:`1px solid ${T.border}`, background:'none', color: T.text3, borderRadius: T.radius, cursor:'pointer' }}>
                {canvasFull ? '⊡' : '⛶'}
              </button>
              {/* Close */}
              <button onClick={() => { setCanvas(null); setCanvasFull(false); }}
                style={{ padding:'4px 8px', fontSize:12, border:`1px solid ${T.border}`, background:'none', color: T.text3, borderRadius: T.radius, cursor:'pointer' }}>
                ✕
              </button>
            </div>

            {/* Canvas Content */}
            <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
              {canvasTab === 'preview' ? (
                <iframe
                  key={canvas.code}
                  srcDoc={buildPreview(canvas.code, canvas.lang)}
                  sandbox="allow-scripts allow-same-origin"
                  style={{ width:'100%', height:'100%', border:'none', background:'#fff' }}
                  title="Canvas Preview"
                />
              ) : (
                <div style={{ height:'100%', overflow:'auto', padding:16 }}>
                  <pre style={{
                    margin:0, fontFamily:"'Fira Code',monospace", fontSize:13,
                    color: T.text2, lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-all'
                  }}>
                    <code>{canvas.code}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="input-wrap" style={{ flexShrink:0, padding:'10px 28px 24px', borderTop:`1px solid ${T.border2}`, background: T.bg }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          {ttsError && <div style={{ fontSize:13, color:'#ef4444', marginBottom:8, fontWeight:600 }}>⚠ {ttsError}</div>}
          {loading && status && (
            <div style={{ fontSize:13, color: T.accent, marginBottom:8, display:'flex', alignItems:'center', gap:8, fontWeight:600 }}>
              <div style={{ width:7, height:7, background: T.accent, borderRadius:'50%', animation:'bounce 1.5s infinite', flexShrink:0 }}/>
              {status}
            </div>
          )}
          <div className="ibx" style={{ background: T.inputBg, border:`1px solid ${T.border}`, borderRadius: T.radius }}>
            {previewImage && (
              <div style={{ padding:'12px 14px 0' }}>
                <div style={{ position:'relative', display:'inline-block' }}>
                  <img src={previewImage} alt="preview" style={{ width:76, height:76, objectFit:'cover', border:`2px solid ${T.accent}`, display:'block', borderRadius: T.radius }}/>
                  <button onClick={() => setPreviewImage(null)}
                    style={{ position:'absolute', top:-7, right:-7, width:20, height:20, background: T.accent, border:'none', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: T.accentFg }}>
                    <X size={11}/>
                  </button>
                </div>
              </div>
            )}
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, padding:10 }}>
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                <button style={iconBtn} className="ihover" title="Attach file / PDF / image" onClick={() => fileRef.current?.click()}>
                  <Paperclip size={16}/>
                </button>
                <button
                  style={{ ...iconBtn, color: recording ? '#ef4444' : T.text3, borderColor: recording ? '#ef4444' : T.border }}
                  className={recording ? 'rec-pulse' : 'ihover'}
                  title={recording ? 'Click to stop recording' : 'Click to record voice (up to 60s)'}
                  onClick={handleMic}
                >
                  {recording ? <Square size={16}/> : <Mic size={16}/>}
                </button>
              </div>
              <textarea ref={textareaRef} value={input} rows={1} placeholder={i.placeholder}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} }}/>
              <button onClick={handleSend} disabled={!canSend}
                style={{ width:38, height:38, border:'none', cursor: canSend?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: canSend?T.accent:T.bg3, color: canSend?T.accentFg:T.text3, borderRadius: T.radius, transition:'background .15s' }}>
                <Send size={16}/>
              </button>
            </div>
            {/* ── Tool selector pills ── */}
            {(() => {
              const primary = [
                { id:'auto',    label: lang==='zh' ? '✦ 自動' : '✦ Auto' },
                { id:'search',  label: '🔍 ' + (lang==='zh' ? '搜尋' : 'Search') },
                { id:'image',   label: '🎨 ' + (lang==='zh' ? '生圖' : 'Image') },
                { id:'news',    label: '📰 ' + (lang==='zh' ? '新聞' : 'News') },
                { id:'weather', label: '🌤 ' + (lang==='zh' ? '天氣' : 'Weather') },
                { id:'crypto',  label: '💰 ' + (lang==='zh' ? '幣價' : 'Crypto') },
              ];
              const secondary = [
                { id:'stock',       label: '📊 ' + (lang==='zh' ? '股票' : 'Stock') },
                { id:'currency',    label: '💱 ' + (lang==='zh' ? '匯率' : 'Currency') },
                { id:'wiki',        label: '📖 Wiki' },
                { id:'calc',        label: '🧮 ' + (lang==='zh' ? '計算' : 'Calc') },
                { id:'hackernews',  label: '🔥 HN' },
                { id:'arxiv',       label: '📐 arXiv' },
                { id:'github',      label: '🐙 GitHub' },
              ];
              const allTools = toolsExpanded ? [...primary, ...secondary] : primary;
              const hasSecondaryActive = secondary.some(t => t.id === selectedTool);
              const pillStyle = (active: boolean): React.CSSProperties => ({
                flexShrink: 0, padding: '4px 10px', fontSize: 12,
                fontWeight: active ? 700 : 500,
                border: `1px solid ${active ? T.accent : T.border}`,
                borderRadius: 20,
                background: active ? T.accent : 'transparent',
                color: active ? T.accentFg : T.text3,
                cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
              });
              return (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:'6px 10px 8px' }}>
                  {allTools.map(tool => {
                    const active = selectedTool === tool.id;
                    return (
                      <button key={tool.id}
                        onClick={() => setSelectedTool(active && tool.id !== 'auto' ? 'auto' : tool.id)}
                        style={pillStyle(active)}>
                        {tool.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setToolsExpanded(v => !v)}
                    style={{ ...pillStyle(hasSecondaryActive), borderStyle: 'dashed' }}>
                    {toolsExpanded ? '▲' : (hasSecondaryActive ? `● ${lang==='zh'?'更多':'More'}` : `+ ${lang==='zh'?'更多':'More'}`)}
                  </button>
                </div>
              );
            })()}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 12px 10px' }}>
              <span style={{ fontSize:12, color: T.text3 }}>{i.hint}</span>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {lastTokens && lastTokens.total > 0 && (
                  <span style={{ fontSize:11, color: T.text3, fontFamily:'monospace' }}
                    title={`Session: ${sessionTokens.total.toLocaleString()} tokens · ${sessionTokens.calls} calls`}>
                    ⚡ {lastTokens.total.toLocaleString()} tk
                    <span style={{ color: T.accent, marginLeft:4 }}>[{lastTokens.prompt}↑ {lastTokens.completion}↓]</span>
                  </span>
                )}
                <span style={{ fontSize:12, fontWeight:600, color: hasAnyKey ? T.accent : T.text3 }}>
                  {hasAnyKey ? i.connected : i.setup}
                </span>
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFile}
            accept="image/*,audio/*,.txt,.md,.py,.js,.ts,.json,.csv,.html,.css,.pdf"/>
        </div>
      </div>

      {/* ── Settings modal ── */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(10px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if(e.target===e.currentTarget && hasAnyKey) setShowSettings(false); }}>
          <div style={{ background: T.bg, border:`2px solid ${isDark?T.accent:T.border}`, padding:36, width:460, maxWidth:'92vw', borderRadius: T.radius, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', color: T.accent, textTransform:'uppercase', marginBottom:8 }}>{i.configEyebrow}</div>
                <div style={{ fontSize:22, fontWeight:800, color: T.text }}>{i.configTitle}</div>
              </div>
              {hasAnyKey && (
                <button onClick={() => setShowSettings(false)}
                  style={{ background:'none', border:`1px solid ${T.border}`, color: T.text3, cursor:'pointer', padding:'4px 8px', borderRadius: T.radius, fontSize:16, lineHeight:1, display:'flex', alignItems:'center' }}>✕</button>
              )}
            </div>

            {/* OR key with test button */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, color: T.accent, marginBottom:6, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>
                {i.keyOR} *
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input type="password" value={orKey} onChange={e => { setOrKey(e.target.value); setKeyTestStatus('idle'); }} placeholder="sk-or-v1-…" className="finput"
                  style={{ flex:1, padding:'10px 14px', background: T.inputBg, border:`1px solid ${!orKey ? '#ef4444' : T.border}`, color: T.text, fontSize:14, borderRadius: T.radius }}/>
                <button onClick={() => testOrKey(orKey)} disabled={!orKey || keyTestStatus==='testing'}
                  style={{ flexShrink:0, padding:'0 14px', fontSize:12, fontWeight:700, border:`1px solid ${T.border}`, background: T.bg3, color: T.text3, borderRadius: T.radius, cursor: orKey?'pointer':'not-allowed', whiteSpace:'nowrap' }}>
                  {keyTestStatus==='testing' ? '⏳…' : (lang==='zh' ? '測試' : 'Test')}
                </button>
              </div>
              {keyTestStatus !== 'idle' && keyTestStatus !== 'testing' && (
                <div style={{ marginTop:6, fontSize:12, fontWeight:600, color:
                  keyTestStatus==='ok' ? '#22c55e' :
                  keyTestStatus==='ratelimit' ? '#f59e0b' : '#ef4444' }}>
                  {keyTestStatus==='ok'        ? '✓ Key valid — connected!' :
                   keyTestStatus==='ratelimit' ? '⚠ Rate limit hit (50 req/day). This key is exhausted. Create a new key at openrouter.ai or wait until tomorrow.' :
                                                 '✗ Invalid key — check and re-enter.'}
                </div>
              )}
            </div>

            {[
              { label: i.keyGroq,      val: groqKey,   set: setGroqKey,   ph: 'gsk_…',                  pwd: true,  required: false },
              { label: i.keyHF,        val: hfToken,   set: setHfToken,   ph: 'hf_…',                   pwd: true,  required: false },
              { label: i.keyClaw,      val: clawUrl,   set: setClawUrl,   ph: 'http://127.0.0.1:3002',  pwd: false, required: false },
              { label: i.keyClawToken, val: clawToken, set: setClawToken, ph: 'claw_token_…',            pwd: true,  required: false },
              { label: i.keyMCP,       val: mcpUrl,    set: setMcpUrl,    ph: 'http://localhost:3000',   pwd: false, required: false },
            ].map(f => (
              <div key={f.label} style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, color: T.text3, marginBottom:6, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>
                  {f.label}
                </label>
                <input type={f.pwd ? "password" : "text"} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="finput"
                  style={{ width:'100%', padding:'10px 14px', background: T.inputBg, border:`1px solid ${T.border}`, color: T.text, fontSize:14, borderRadius: T.radius }}/>
              </div>
            ))}

            <p style={{ fontSize:12, color: T.text3, lineHeight:1.8, margin:'18px 0', borderLeft:`2px solid ${T.border}`, paddingLeft:14, whiteSpace:'pre-line' }}>{i.keyNote}</p>
            <button disabled={!hasAnyKey} onClick={() => setShowSettings(false)}
              style={{ width:'100%', padding:14, border:'none', fontSize:15, fontWeight:700, cursor: hasAnyKey?'pointer':'not-allowed', background: hasAnyKey?T.accent:T.bg3, color: hasAnyKey?T.accentFg:T.text3, borderRadius: T.radius, opacity: hasAnyKey?1:0.4 }}>
              {i.start}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
