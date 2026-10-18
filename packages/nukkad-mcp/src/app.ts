/**
 * The deployed Nukkad backend: one Lambda Function URL that serves
 *   /mcp           MCP 2025-11-25 Streamable HTTP (stateless), via mcp-lambda-kit
 *   /api/chat      LLM proxy for the simulated Alexa+ host, key stays server side
 *   /api/shop/:id  shop console data, /api/orders/:id/status to move an order
 *   everything else: the static web app
 * The demo data resets once a day at 3 AM IST: the first request after 3 AM claims the reset,
 * and a scheduled direct invoke with { "nukkad": "reset" } does it on the dot. Neither can be
 * triggered on demand over the Function URL.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createLambdaHandler } from '@nukkad/mcp-lambda-kit';
import { createNukkadServer } from './index.js';
import { MemoryStorage } from './storage/memory.js';
import { DynamoStorage } from './storage/dynamo.js';
import type { StorageLayer } from './storage/interface.js';
import { shopDashboard } from './tools/index.js';

const TABLE = process.env.NUKKAD_TABLE;
let memory: MemoryStorage | undefined;
const storage = (): StorageLayer => (TABLE ? new DynamoStorage(TABLE) : (memory ??= new MemoryStorage()));

const SYSTEM = `You are the voice of Nukkad inside Alexa+. Nukkad connects the customer to the independent shops on their street: Sharma's Corner Store (kirana), Fresh Breads Bakery and Pure Milk Dairy.
The signed in customer is Meera, customerId "customer-1". Never ask for the id.
Speak like a warm, brisk shopkeeper friend. Replies are spoken aloud, so keep them to two short sentences, no lists, no markdown, no emojis. Say amounts as rupees, for example 1,240 rupees.
Party or guest requests: call get_usual, then build_cart with fromUsual true and scaleBy 2 for up to 3 guests, 3 for 4 to 7 guests, 4 for 8 or more. Then check_stock_and_substitute, then place_order with deliverBy set to the day they said, for example Saturday. place_order checks the khata credit limit itself, so do not call khata_balance before it. If they paid on khata, call khata_balance once after place_order so they see the updated credit. Do the whole chain without asking for confirmation when the user already asked you to order or to put it on khata. Do not state how many people the order serves. Mention any substitution in one short clause.
For a reorder, call build_cart with fromUsual true then check_stock_and_substitute then place_order.
Hinglish words are fine: atta, doodh, chini, khata. Never invent prices or stock, only use tool results.`;

// Light per instance rate limit so a public demo cannot drain the LLM balance.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

async function chat(req: Request, ip = 'local') {
  if (limited(ip)) return Response.json({ error: 'slow_down' }, { status: 429 });
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return Response.json({ error: 'LLM not configured' }, { status: 503 });
  const body = (await req.json().catch(() => null)) as any;
  if (!body || !Array.isArray(body.messages)) return Response.json({ error: 'bad_request' }, { status: 400 });
  const messages = body.messages.filter((m: any) => m && m.role !== 'system').slice(-40);
  if (JSON.stringify(messages).length > 60000) return Response.json({ error: 'too_large' }, { status: 413 });
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 20) : undefined;
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 500, messages: [{ role: 'system', content: SYSTEM }, ...messages], tools, tool_choice: tools ? 'auto' : undefined }),
  });
  if (!r.ok) { console.error('deepseek', r.status, await r.text().catch(() => '')); return Response.json({ error: 'llm_error', status: r.status }, { status: 502 }); }
  const data = (await r.json()) as any;
  return Response.json({ message: data.choices?.[0]?.message, finish_reason: data.choices?.[0]?.finish_reason });
}

const STATIC_DIR = process.env.NUKKAD_STATIC_DIR ?? join(process.cwd(), 'public');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.webp': 'image/webp',
};
async function serveStatic(req: Request) {
  let p = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith('/')) p += 'index.html';
  const candidates = [p, `${p}.html`, `${p}/index.html`];
  for (const c of candidates) {
    const f = join(STATIC_DIR, c);
    if (f.startsWith(STATIC_DIR) && existsSync(f) && !f.endsWith('/')) {
      try {
        const buf = await readFile(f);
        const type = TYPES[extname(f)] ?? 'application/octet-stream';
        const cache = c.includes('/_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache';
        return new Response(buf, { headers: { 'content-type': type, 'cache-control': cache } });
      } catch { /* directory */ }
    }
  }
  const nf = join(STATIC_DIR, '404.html');
  if (existsSync(nf)) return new Response(await readFile(nf), { status: 404, headers: { 'content-type': TYPES['.html'] } });
  return Response.json({ error: 'not_found' }, { status: 404 });
}

const httpHandler = createLambdaHandler({
  createServer: () => createNukkadServer(storage()),
  routes: {
    '/health': () => Response.json({ ok: true, storage: TABLE ? 'dynamodb' : 'memory', protocol: '2025-11-25' }),
    '/api/chat': (req, event) => (req.method === 'POST' ? chat(req, event.requestContext.http.sourceIp) : new Response(null, { status: 405 })),
    '/api/shop/*': async (req) => {
      const id = new URL(req.url).pathname.split('/')[3];
      try { return Response.json(await shopDashboard(id, storage())); } catch (e: any) { return Response.json({ error: e.message }, { status: 404 }); }
    },
    '/api/orders/*': async (req) => {
      if (req.method !== 'POST') return new Response(null, { status: 405 });
      const id = new URL(req.url).pathname.split('/')[3];
      const { status } = (await req.json().catch(() => ({}))) as any;
      if (!['accepted', 'ready', 'delivered', 'cancelled'].includes(status)) return Response.json({ error: 'bad_status' }, { status: 400 });
      const s = storage();
      await s.updateOrderStatus(id, status);
      return Response.json(await s.getOrder(id));
    },
  },
  fallback: serveStatic,
});

/** Restore the seeded shops, stock, customers, orders and khata balances. */
export async function resetDemoData() {
  if (TABLE) await new DynamoStorage(TABLE).reset(); else memory = new MemoryStorage();
}

/**
 * Day key for the nightly reset: the date in IST, rolling over at 3 AM IST.
 * IST is UTC+5:30, so 3 AM IST is UTC+2:30 of the same day key.
 */
export const resetDay = (now = Date.now()) => new Date(now + 2.5 * 3600_000).toISOString().slice(0, 10);

let checkedDay: string | undefined;
/**
 * Backup for the schedule: the first request after 3 AM IST resets the demo data once,
 * claimed with a conditional write so only one instance runs it.
 */
async function ensureDailyReset() {
  if (!TABLE) return;
  const day = resetDay();
  if (checkedDay === day) return;
  try {
    const db = new DynamoStorage(TABLE);
    if (await db.claimDailyReset(day)) { await db.reset(); console.log('nukkad daily reset', day); }
    checkedDay = day;
  } catch (e) { console.error('nukkad daily reset failed', e); }
}

/**
 * Function URL events always carry requestContext.http. The scheduled reset event is a plain
 * object with no requestContext, which only a direct Lambda invoke, for example from
 * EventBridge Scheduler with IAM permission, can send.
 */
export const handler = async (event: any) => {
  if (event && !event.requestContext && event.nukkad === 'reset') {
    const started = Date.now();
    await resetDemoData();
    console.log('nukkad demo reset', { ms: Date.now() - started });
    return { ok: true, reset: true };
  }
  await ensureDailyReset();
  return httpHandler(event);
};
