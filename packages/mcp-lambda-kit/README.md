# mcp-lambda-kit

Run a stateless MCP Streamable HTTP server, spec version 2025-11-25, on an AWS Lambda Function URL.

Every request gets a fresh MCP server and transport, and responses are plain JSON. There is no session store, no SSE stream to keep alive, and the function scales to zero when nobody is calling it. The live Nukkad demo runs on this package.

## What it does

* Turns a Lambda Function URL event into a web standard `Request`, and the `Response` back into a Function URL result. Binary bodies are base64 encoded.
* Runs MCP requests on the SDK `WebStandardStreamableHTTPServerTransport` in stateless JSON mode.
* Answers `GET` on the MCP path with `405`, which the spec allows for servers without a standalone event stream.
* Adds CORS headers and answers `OPTIONS` preflight.
* Routes extra paths to your own handlers, by exact path or by a prefix ending in `*`, with an optional fallback, for example static files.
* Optional bearer token check on the MCP path. A failed check returns `401` with a `WWW-Authenticate` header.
* Optional RFC 9728 protected resource metadata at `/.well-known/oauth-protected-resource`.

## Install

The package is not published to npm. Use it in one of these ways:

* Copy `src/index.ts` into your project. It is a single file with one runtime dependency, `@modelcontextprotocol/sdk`.
* Or clone the repository and depend on the package folder:

```bash
git clone https://github.com/RockingThor/mcp-lambda-kit.git
cd your-project
pnpm add ../mcp-lambda-kit
```

It needs a version of `@modelcontextprotocol/sdk` that ships `server/webStandardStreamableHttp.js`. It is tested with 1.32.1.

## Usage

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createLambdaHandler } from '@nukkad/mcp-lambda-kit';

function createServer() {
  const server = new McpServer({ name: 'hello', version: '1.0.0' });
  server.registerTool('greet', {
    title: 'Greet',
    description: 'Say hello to someone',
    inputSchema: { name: z.string() },
  }, async ({ name }) => ({ content: [{ type: 'text', text: `Hello, ${name}` }] }));
  return server;
}

export const handler = createLambdaHandler({
  createServer,                       // called once per request
  mcpPath: '/mcp',                    // default
  routes: {
    '/health': () => Response.json({ ok: true }),
    '/api/items/*': (req) => Response.json({ path: new URL(req.url).pathname }),
  },
  // fallback: (req) => serveStaticFile(req),
  // cors: 'https://your.site',        // default '*', false turns it off
  // authorize: (token) => token === process.env.MCP_TOKEN,
  // protectedResource: { resource: 'https://your.url/mcp', authorization_servers: ['https://auth.example.com'] },
});
```

Bundle that file, for example with esbuild, deploy it to a Node 22 Lambda with the handler set to the exported `handler`, and add a Function URL. Any MCP client can then connect to `https://<function-url>/mcp`.

The returned handler also has a `fetch(req, event)` method that takes a web standard `Request`, which is handy for tests and local servers.

## API

### `createLambdaHandler(options)`

Returns `handler(event)` for a Function URL, with a `fetch` method attached.

| Option | Description |
| --- | --- |
| `createServer` | Required. Returns a new `McpServer` or `Server`, or a promise of one, for each request. |
| `mcpPath` | Path of the MCP endpoint. Default `/mcp`. |
| `routes` | Map of path to `(req, event) => Response`. A key ending in `*` matches by prefix. |
| `fallback` | Handler for anything not matched. Default is a JSON `404`. |
| `cors` | Allowed origin. Default `*`. `false` disables CORS headers. |
| `authorize` | `(token, req) => boolean`. Called for the MCP path with the bearer token, or `undefined`. |
| `protectedResource` | RFC 9728 metadata object served at `/.well-known/oauth-protected-resource` and referenced from the `401` response. |

### Lower level helpers

* `handleMcpRequest(req, createServer)`: handle one MCP request statelessly and return a `Response`.
* `toWebRequest(event)` and `fromWebResponse(res, extraHeaders?)`: the event and result conversions.
* `MCP_PROTOCOL_VERSION`: `'2025-11-25'`.
* Types: `FunctionUrlEvent`, `FunctionUrlResult`, `LambdaKitOptions`, `RouteHandler`, `ServerFactory`.

## Tests

```bash
pnpm install
pnpm test
```

The tests cover protocol negotiation on 2025-11-25, stateless tool listing and calling, CORS and custom routes, and the bearer token check.

## License

MIT. See [LICENSE](./LICENSE).
