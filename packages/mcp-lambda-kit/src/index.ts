import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface LambdaFunctionURLEvent {
  version: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  requestContext: {
    requestId: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
  };
  body?: string;
  isBase64Encoded: boolean;
}

export interface LambdaFunctionURLResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ProtectedResourceMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

export interface MCPAppsResource {
  uri: string;
  name: string;
  description?: string;
  mimeType: string;
}

export interface StreamableHTTPHandlerOptions {
  server: Server;
  devBypassAuth?: boolean;
  validateToken?: (token: string) => Promise<boolean>;
}

export async function handleStreamableHTTP(
  event: LambdaFunctionURLEvent,
  options: StreamableHTTPHandlerOptions
): Promise<LambdaFunctionURLResponse> {
  const { server, devBypassAuth = false, validateToken } = options;
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  // Auth check (unless dev bypass)
  if (!devBypassAuth && validateToken) {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer',
        },
        body: JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid token' }),
      };
    }

    const token = authHeader.substring(7);
    const isValid = await validateToken(token);
    if (!isValid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer error="invalid_token"',
        },
        body: JSON.stringify({ error: 'unauthorized', message: 'Invalid token' }),
      };
    }
  }

  // Handle MCP Streamable HTTP
  if (method === 'POST' && path === '/mcp') {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf-8')
      : event.body || '';

    try {
      // Parse incoming JSON-RPC message
      const message = JSON.parse(body);

      // Directly invoke the request handler
      const handler = (server as any)._requestHandlers?.get(message.method);
      if (!handler) {
        throw new Error(`No handler for method: ${message.method}`);
      }

      const result = await handler.call(server, message);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result,
        }),
      };
    } catch (error: any) {
      console.error('MCP request error:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: body ? (JSON.parse(body) as any).id || null : null,
          error: {
            code: -32603,
            message: error.message || 'Internal error',
          },
        }),
      };
    }
  }

  // Unknown path
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'not_found' }),
  };
}

export function createProtectedResourceMetadata(
  issuer: string,
  authEndpoint: string,
  tokenEndpoint: string
): ProtectedResourceMetadata {
  return {
    issuer,
    authorization_endpoint: authEndpoint,
    token_endpoint: tokenEndpoint,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
  };
}

export function handleProtectedResourceMetadata(
  event: LambdaFunctionURLEvent,
  metadata: ProtectedResourceMetadata
): LambdaFunctionURLResponse | null {
  if (
    event.requestContext.http.method === 'GET' &&
    event.rawPath === '/.well-known/oauth-authorization-server'
  ) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(metadata),
    };
  }
  return null;
}

export function createMCPAppsResource(
  uri: string,
  name: string,
  mimeType: string,
  description?: string
): MCPAppsResource {
  return {
    uri,
    name,
    description,
    mimeType,
  };
}
