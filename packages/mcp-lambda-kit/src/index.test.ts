import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createLambdaHandler, MCP_PROTOCOL_VERSION, type FunctionUrlEvent } from './index.js';

function makeServer() {
  const s = new McpServer({ name: 'test', version: '1.0.0' });
  s.registerTool('echo', { description: 'Echo text', inputSchema: { text: z.string() } }, async ({ text }) => ({
    content: [{ type: 'text', text }],
  }));
  return s;
}

const ev = (method: string, path: string, body?: unknown): FunctionUrlEvent => ({
  rawPath: path,
  headers: {
    host: 'example.lambda-url.us-east-1.on.aws',
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': MCP_PROTOCOL_VERSION,
  },
  requestContext: { http: { method } },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('mcp-lambda-kit', () => {
  const handler = createLambdaHandler({ createServer: makeServer, routes: { '/health': () => Response.json({ ok: true }) } });

  it('negotiates protocol 2025-11-25 on initialize', async () => {
    const res = await handler(ev('POST', '/mcp', {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 't', version: '1' } },
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.protocolVersion).toBe('2025-11-25');
    expect(res.headers?.['access-control-allow-origin']).toBe('*');
  });

  it('lists and calls tools statelessly', async () => {
    const list = JSON.parse((await handler(ev('POST', '/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list' }))).body);
    expect(list.result.tools.map((t: any) => t.name)).toContain('echo');
    const call = JSON.parse((await handler(ev('POST', '/mcp', {
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { text: 'namaste' } },
    }))).body);
    expect(call.result.content[0].text).toBe('namaste');
  });

  it('answers CORS preflight and custom routes', async () => {
    expect((await handler(ev('OPTIONS', '/mcp'))).statusCode).toBe(204);
    expect(JSON.parse((await handler(ev('GET', '/health'))).body).ok).toBe(true);
    expect((await handler(ev('GET', '/mcp'))).statusCode).toBe(405);
    expect((await handler(ev('GET', '/nope'))).statusCode).toBe(404);
  });

  it('enforces bearer auth when configured', async () => {
    const h = createLambdaHandler({
      createServer: makeServer,
      authorize: (t) => t === 'secret',
      protectedResource: { resource: 'https://x/mcp', authorization_servers: ['https://auth.x'] },
    });
    const res = await h(ev('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }));
    expect(res.statusCode).toBe(401);
    expect(res.headers?.['www-authenticate']).toContain('resource_metadata');
    const meta = JSON.parse((await h(ev('GET', '/.well-known/oauth-protected-resource'))).body);
    expect(meta.authorization_servers[0]).toBe('https://auth.x');
  });
});
