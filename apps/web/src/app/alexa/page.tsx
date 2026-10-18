'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from '@/components/Nav';
import AppFrame from '@/components/AppFrame';
import { McpClient, type McpTool, type WireEvent } from '@/lib/mcp-client';
import s from './alexa.module.css';

type Step = { name: string; title: string; ms?: number; ok?: boolean };
type Card = { uri: string; result: any };
type Turn = { role: 'user' | 'assistant'; text: string; steps?: Step[]; cards?: Card[]; pending?: boolean };

const SUGGESTIONS = [
  "I'm having six friends over on Saturday for chai and snacks. Get what I usually get, enough for everyone, and put it on my khata.",
  "What's my khata balance?",
  'Where is my order?',
  'Do you have atta and doodh?',
];

const MCP_URL = '/mcp';

export default function AlexaPage() {
  const client = useRef<McpClient | null>(null);
  const tools = useRef<McpTool[]>([]);
  const views = useRef(new Map<string, string>());
  const history = useRef<any[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [wire, setWire] = useState<WireEvent[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [ready, setReady] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [server, setServer] = useState<{ name?: string; version?: string; protocol?: string }>({});
  const scroller = useRef<HTMLDivElement>(null);
  const wireEnd = useRef<HTMLDivElement>(null);
  const rec = useRef<any>(null);

  useEffect(() => {
    const c = new McpClient(MCP_URL);
    c.onWire = (e) => setWire((w) => [...w, e]);
    client.current = c;
    (async () => {
      try {
        const init = await c.initialize();
        setServer({ name: init.serverInfo?.title ?? init.serverInfo?.name, version: init.serverInfo?.version, protocol: init.protocolVersion });
        tools.current = (await c.listTools()).tools;
        setReady('ready');
      } catch { setReady('error'); }
    })();
  }, []);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [turns]);
  useEffect(() => { wireEnd.current?.scrollIntoView({ block: 'end' }); }, [wire]);

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; u.rate = 1.03;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang === 'en-IN') ?? window.speechSynthesis.getVoices().find((x) => x.lang.startsWith('en'));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  const updateLast = (fn: (t: Turn) => Turn) => setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);

  const run = useCallback(async (text: string) => {
    const c = client.current;
    if (!c || busy || !text.trim()) return;
    setBusy(true); setInput('');
    setTurns((t) => [...t, { role: 'user', text }, { role: 'assistant', text: '', steps: [], cards: [], pending: true }]);
    history.current.push({ role: 'user', content: text });
    const llmTools = tools.current.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
    try {
      for (let i = 0; i < 10; i++) {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.current, tools: llmTools }) });
        if (!r.ok) throw new Error('The assistant is unavailable right now');
        const { message } = await r.json();
        const calls = message?.tool_calls ?? [];
        history.current.push({ role: 'assistant', content: message?.content ?? '', ...(calls.length ? { tool_calls: calls } : {}) });
        if (!calls.length) {
          const reply = (message?.content ?? '').trim() || 'Done.';
          updateLast((t) => ({ ...t, text: reply, pending: false }));
          speak(reply);
          break;
        }
        for (const call of calls) {
          const tool = tools.current.find((t) => t.name === call.function.name);
          const step: Step = { name: call.function.name, title: tool?.title ?? call.function.name };
          updateLast((t) => ({ ...t, steps: [...(t.steps ?? []), step] }));
          const t0 = performance.now();
          let args: any = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* keep empty */ }
          let res: any;
          try { res = await c.callTool(call.function.name, args); } catch (e: any) { res = { isError: true, content: [{ type: 'text', text: e.message }] }; }
          const ms = Math.round(performance.now() - t0);
          updateLast((t) => ({ ...t, steps: (t.steps ?? []).map((x) => (x === step || (x.name === step.name && x.ms === undefined) ? { ...x, ms, ok: !res.isError } : x)) }));
          const uri = tool?._meta?.ui?.resourceUri ?? tool?._meta?.['ui/resourceUri'];
          if (uri && !res.isError && res.structuredContent) {
            if (!views.current.has(uri)) {
              const rr = await c.readResource(uri);
              views.current.set(uri, rr.contents?.[0]?.text ?? '');
            }
            updateLast((t) => {
              const cards = (t.cards ?? []).filter((x) => x.uri !== uri);
              return { ...t, cards: [...cards, { uri, result: res }] };
            });
          }
          const textOut = (res.content ?? []).map((p: any) => p.text ?? '').join('\n').slice(0, 6000);
          history.current.push({ role: 'tool', tool_call_id: call.id, content: textOut });
        }
      }
    } catch (e: any) {
      updateLast((t) => ({ ...t, text: e.message ?? 'Something went wrong', pending: false }));
    } finally { setBusy(false); }
  }, [busy]);

  const mic = () => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { setInput(SUGGESTIONS[0]); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-IN'; r.interimResults = true; r.continuous = false;
    r.onresult = (e: any) => {
      const txt = Array.from(e.results).map((x: any) => x[0].transcript).join(' ');
      setInput(txt);
      if (e.results[e.results.length - 1].isFinal) { r.stop(); run(txt); }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  };

  const orb = listening ? s.orbListen : busy ? s.orbThink : s.orbIdle;

  return (
    <div className={s.page}>
      <Nav active="alexa" />
      <div className={s.main}>
        <section className={s.convo}>
          <div className={s.scroll} ref={scroller}>
            {turns.length === 0 ? (
              <div className={s.hero}>
                <div className={`${s.orb} ${orb}`}><span /></div>
                <h1>Alexa, open Nukkad.</h1>
                <p>Talk to the shops on your street. Your usual, party orders, khata and live tracking, all through one MCP server.</p>
                <div className={s.chips}>
                  {SUGGESTIONS.map((q) => (
                    <button key={q} className={s.chip} onClick={() => run(q)} disabled={ready !== 'ready' || busy}>{q}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={s.thread}>
                {turns.map((t, i) => t.role === 'user' ? (
                  <div key={i} className={s.user}><div>{t.text}</div></div>
                ) : (
                  <div key={i} className={s.bot}>
                    <div className={s.botHead}><div className={`${s.orbSm} ${t.pending ? s.orbThink : s.orbIdle}`}><span /></div>Alexa+ with Nukkad</div>
                    {!!t.steps?.length && (
                      <div className={s.steps}>
                        {t.steps.map((st, j) => (
                          <span key={j} className={`${s.step} ${st.ok === false ? s.stepErr : st.ms !== undefined ? s.stepOk : ''}`}>
                            <i />{st.title}{st.ms !== undefined && <em>{st.ms} ms</em>}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.cards?.map((c) => <div key={c.uri} className={s.card}><AppFrame html={views.current.get(c.uri) ?? ''} result={c.result} /></div>)}
                    {t.pending ? <div className={s.typing}><span /><span /><span /></div> : <p className={s.reply}>{t.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={s.composer}>
            <button className={`${s.mic} ${listening ? s.micOn : ''}`} onClick={mic} disabled={busy || ready !== 'ready'} aria-label="Speak">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(input)}
              placeholder={listening ? 'Listening' : 'Ask Nukkad anything, or tap the mic'} disabled={busy} />
            <button className={s.send} onClick={() => run(input)} disabled={busy || !input.trim()}>Send</button>
          </div>
        </section>

        <aside className={s.inspector}>
          <div className={s.inHead}>
            <div>
              <div className={s.kicker}>MCP inspector</div>
              <div className={s.inTitle}>Streamable HTTP, JSON-RPC 2.0</div>
            </div>
            <span className={`pill ${ready === 'ready' ? 'g live' : ready === 'error' ? 'r' : ''}`}><span className="dot" />{ready === 'ready' ? 'Connected' : ready === 'error' ? 'Offline' : 'Connecting'}</span>
          </div>
          <div className={s.meta}>
            <div><span>Server</span><b>{server.name ?? 'Nukkad'} {server.version}</b></div>
            <div><span>Protocol</span><b className="mono">{server.protocol ?? '2025-11-25'}</b></div>
            <div><span>Tools</span><b>{tools.current.length || 9}</b></div>
            <div><span>Endpoint</span><b className="mono">POST /mcp</b></div>
          </div>
          <div className={s.wire}>
            {wire.map((w) => (
              <div key={w.id} className={`${s.ev} ${w.dir === 'out' ? s.evOut : s.evIn} ${w.error ? s.evErr : ''}`} onClick={() => setOpen(open === w.id ? null : w.id)}>
                <div className={s.evRow}>
                  <span className={s.arrow}>{w.dir === 'out' ? '→' : '←'}</span>
                  <span className="mono">{w.method}</span>
                  {w.dir === 'out' && w.payload?.params?.name && <span className={s.evName}>{w.payload.params.name}</span>}
                  {w.dir === 'out' && w.payload?.params?.uri && <span className={s.evName}>{w.payload.params.uri}</span>}
                  <span className={s.evMs}>{w.ms !== undefined ? `${w.ms} ms` : new Date(w.at).toLocaleTimeString('en-IN', { hour12: false })}</span>
                </div>
                {open === w.id && <pre className="mono">{JSON.stringify(w.payload, null, 2).slice(0, 4000)}</pre>}
              </div>
            ))}
            <div ref={wireEnd} />
          </div>
        </aside>
      </div>
    </div>
  );
}
