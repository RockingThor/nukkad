/** Local dev server: same handler as Lambda, on http://localhost:8787 */
import 'dotenv/config';
import { createServer } from 'node:http';
import { handler } from './app.js';

const port = Number(process.env.PORT ?? 8787);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
  const out: any = await handler({
    rawPath: url.pathname, rawQueryString: url.search.slice(1), headers,
    requestContext: { http: { method: req.method ?? 'GET' } },
    body: chunks.length ? Buffer.concat(chunks).toString('base64') : undefined, isBase64Encoded: true,
  });
  res.writeHead(out.statusCode, out.headers);
  res.end(out.isBase64Encoded ? Buffer.from(out.body, 'base64') : out.body);
}).listen(port, () => console.log(`Nukkad on http://localhost:${port}  (MCP at /mcp)`));
