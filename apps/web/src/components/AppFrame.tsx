'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * MCP Apps host side: renders a ui:// view in a sandboxed iframe and speaks the
 * ui/* postMessage JSON-RPC protocol (initialize, tool-result, size-changed).
 */
export default function AppFrame({ html, result }: { html: string; result: any }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const latest = useRef(result);
  const [h, setH] = useState(160);
  const send = (m: any) => ref.current?.contentWindow?.postMessage(m, '*');
  const push = () => send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: latest.current });

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const m = e.data || {};
      if (m.method === 'ui/initialize') {
        send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2025-11-25', hostInfo: { name: 'nukkad-alexa-sim', version: '1.0.0' }, hostContext: { theme: 'dark' } } });
      }
      if (m.method === 'ui/notifications/initialized') { ready.current = true; push(); }
      if (m.method === 'ui/notifications/size-changed' && m.params?.height) setH(Math.ceil(m.params.height));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => { latest.current = result; if (ready.current) push(); }, [result]);

  return (
    <iframe ref={ref} srcDoc={html} sandbox="allow-scripts" title="MCP App"
      style={{ width: '100%', height: h, border: 0, display: 'block', borderRadius: 14, background: '#0a0a0a', transition: 'height .2s' }} />
  );
}
