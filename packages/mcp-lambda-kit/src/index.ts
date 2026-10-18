/**
 * mcp-lambda-kit
 *
 * Run a stateless MCP (spec 2025-11-25) Streamable HTTP server on an AWS Lambda
 * Function URL. Every request gets a fresh server and transport, which is the
 * pattern the spec recommends for stateless deployments: no sticky sessions, no
 * SSE stream to keep alive, and cold starts stay small.
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

export const MCP_PROTOCOL_VERSION = '2025-11-25';

if (LATEST_PROTOCOL_VERSION !== MCP_PROTOCOL_VERSION) {
  // Fail loudly at cold start if the SDK drifts from the spec version we target.
  console.warn(`mcp-lambda-kit: SDK latest protocol is ${LATEST_PROTOCOL_VERSION}, expected ${MCP_PROTOCOL_VERSION}`);
}

export interface FunctionUrlEvent {
  version?: string;
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  requestContext: { http: { method: string; path?: string; sourceIp?: string } ; domainName?: string };
  body?: string;
  isBase64Encoded?: boolean;
}

export interface FunctionUrlResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export type ServerFactory = () => Server | McpServer | Promise<Server | McpServer>;

export type RouteHandler = (req: Request, event: FunctionUrlEvent) => Promise<Response> | Response;

export interface LambdaKitOptions {
  /** Builds a fresh MCP server for each request. */
  createServer: ServerFactory;
  /** Path the MCP endpoint lives on. Defaults to /mcp. */
  mcpPath?: string;
  /** Extra non MCP routes, matched by exact path or by prefix ending in '*'. */
  routes?: Record<string, RouteHandler>;
  /** Fallback for anything unmatched, for example static files. */
  fallback?: RouteHandler;
  /** CORS allow origin. Defaults to '*'. Set false to disable CORS headers. */
  cors?: string | false;
  /** Optional bearer token check. Return true to allow. */
  authorize?: (token: string | undefined, req: Request) => Promise<boolean> | boolean;
  /** RFC 9728 protected resource metadata, served at /.well-known/oauth-protected-resource. */
  protectedResource?: { resource: string; authorization_servers: string[]; scopes_supported?: string[] };
}

const CORS_HEADERS = (origin: string) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id, accept, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
  'access-control-max-age': '86400',
});

/** Convert a Lambda Function URL event into a WHATWG Request. */
export function toWebRequest(event: FunctionUrlEvent): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(event.headers ?? {})) if (v !== undefined) headers.set(k, v);
  const host = headers.get('host') ?? event.requestContext.domainName ?? 'localhost';
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `https://${host}${event.rawPath}${qs}`;
  const method = event.requestContext.http.method.toUpperCase();
  let body: string | Buffer | undefined;
  if (event.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
  }
  return new Request(url, { method, headers, body: body as any });
}

const TEXT_TYPES = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;

/** Convert a WHATWG Response into a Lambda Function URL result. */
export async function fromWebResponse(res: Response, extraHeaders: Record<string, string> = {}): Promise<FunctionUrlResult> {
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  Object.assign(headers, extraHeaders);
  const type = headers['content-type'] ?? '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (!type || TEXT_TYPES.test(type)) return { statusCode: res.status, headers, body: buf.toString('utf8') };
  return { statusCode: res.status, headers, body: buf.toString('base64'), isBase64Encoded: true };
}

/** Handle one MCP Streamable HTTP request statelessly. */
export async function handleMcpRequest(req: Request, createServer: ServerFactory): Promise<Response> {
  if (req.method === 'GET') {
    // Stateless servers do not offer a standalone SSE stream (spec allows 405).
    return new Response(null, { status: 405, headers: { allow: 'POST' } });
  }
  const server = await createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await (server as any).connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Close after the response is materialised so the server is not reused.
    queueMicrotask(() => void transport.close().catch(() => {}));
  }
}

function matchRoute(routes: Record<string, RouteHandler>, path: string): RouteHandler | undefined {
  if (routes[path]) return routes[path];
  for (const [k, h] of Object.entries(routes)) if (k.endsWith('*') && path.startsWith(k.slice(0, -1))) return h;
  return undefined;
}

/** Build a Lambda handler for a Function URL. */
export function createLambdaHandler(options: LambdaKitOptions) {
  const mcpPath = options.mcpPath ?? '/mcp';
  const cors = options.cors === false ? {} : CORS_HEADERS(options.cors ?? '*');

  const fetchHandler = async (req: Request, event: FunctionUrlEvent): Promise<Response> => {
    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

    if (options.protectedResource && path === '/.well-known/oauth-protected-resource') {
      return Response.json(options.protectedResource);
    }

    if (path === mcpPath) {
      if (options.authorize) {
        const auth = req.headers.get('authorization') ?? undefined;
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
        if (!(await options.authorize(token, req))) {
          const meta = options.protectedResource
            ? `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource', req.url)}"`
            : 'Bearer';
          return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'www-authenticate': meta } });
        }
      }
      return handleMcpRequest(req, options.createServer);
    }

    const route = options.routes && matchRoute(options.routes, path);
    if (route) return route(req, event);
    if (options.fallback) return options.fallback(req, event);
    return Response.json({ error: 'not_found' }, { status: 404 });
  };

  const handler = async (event: FunctionUrlEvent): Promise<FunctionUrlResult> => {
    try {
      const res = await fetchHandler(toWebRequest(event), event);
      return fromWebResponse(res, cors);
    } catch (err: any) {
      console.error('mcp-lambda-kit error', err);
      return { statusCode: 500, headers: { 'content-type': 'application/json', ...cors }, body: JSON.stringify({ error: 'internal_error' }) };
    }
  };

  return Object.assign(handler, { fetch: fetchHandler });
}
