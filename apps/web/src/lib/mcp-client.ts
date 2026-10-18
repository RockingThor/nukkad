/**
 * A small, real MCP client for the browser. Speaks MCP 2025-11-25 over
 * Streamable HTTP: POST JSON-RPC to the endpoint, accept JSON or SSE replies,
 * send MCP-Protocol-Version on every request after initialize.
 */
export const PROTOCOL_VERSION = '2025-11-25';

export interface McpTool { name: string; title?: string; description?: string; inputSchema: any; _meta?: any }
export interface WireEvent { id: number; dir: 'out' | 'in'; method: string; at: number; ms?: number; payload: any; error?: boolean }

export class McpClient {
  private nextId = 1;
  private negotiated?: string;
  private session?: string;
  onWire?: (e: WireEvent) => void;
  private seq = 0;
  constructor(private endpoint: string) {}

  private headers() {
    const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (this.negotiated) h['mcp-protocol-version'] = this.negotiated;
    if (this.session) h['mcp-session-id'] = this.session;
    return h;
  }

  private async post(msg: any): Promise<any> {
    const t0 = performance.now();
    this.onWire?.({ id: ++this.seq, dir: 'out', method: msg.method, at: Date.now(), payload: msg });
    const res = await fetch(this.endpoint, { method: 'POST', headers: this.headers(), body: JSON.stringify(msg) });
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.session = sid;
    if (msg.id === undefined) return null; // notification, 202 expected
    let body: any;
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('text/event-stream')) {
      const text = await res.text();
      const data = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)));
      body = data.find((d) => d.id === msg.id) ?? data[data.length - 1];
    } else body = await res.json();
    const ms = Math.round(performance.now() - t0);
    this.onWire?.({ id: ++this.seq, dir: 'in', method: msg.method, at: Date.now(), ms, payload: body, error: !!body?.error || !!body?.result?.isError });
    if (body?.error) throw new Error(body.error.message);
    return body.result;
  }

  private request(method: string, params?: any) { return this.post({ jsonrpc: '2.0', id: this.nextId++, method, params }); }

  async initialize() {
    const r = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } },
      clientInfo: { name: 'nukkad-alexa-sim', title: 'Simulated Alexa+ host', version: '1.0.0' },
    });
    this.negotiated = r.protocolVersion;
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return r;
  }
  listTools(): Promise<{ tools: McpTool[] }> { return this.request('tools/list'); }
  callTool(name: string, args: any) { return this.request('tools/call', { name, arguments: args }); }
  readResource(uri: string) { return this.request('resources/read', { uri }); }
}
