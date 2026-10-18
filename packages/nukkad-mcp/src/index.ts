import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { StorageLayer } from './storage/interface.js';
import * as T from './tools/index.js';
import { UI_RESOURCES, MCP_APP_MIME } from './ui/cards.js';

export { MemoryStorage } from './storage/memory.js';
export { DynamoStorage } from './storage/dynamo.js';
export { shopDashboard } from './tools/index.js';
export type { StorageLayer } from './storage/interface.js';

export const PROTOCOL_VERSION = '2025-11-25';

const ui = (uri: string) => ({ ui: { resourceUri: uri }, 'ui/resourceUri': uri });

/** Tool result: short text for the model, structured data for the MCP Apps card. */
const result = (data: any, summary: string) => ({
  content: [{ type: 'text' as const, text: `${summary}\n${JSON.stringify(data)}` }],
  structuredContent: data,
});

const guard = <A>(fn: (a: A) => Promise<{ content: any[]; structuredContent?: any }>) => async (a: A) => {
  try { return await fn(a); } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e?.message ?? e}` }], isError: true };
  }
};

export function createNukkadServer(storage: StorageLayer) {
  const server = new McpServer(
    { name: 'nukkad', title: 'Nukkad', version: '1.0.0' },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        'Nukkad connects a customer to the independent corner shops near them: a kirana, a bakery and a dairy. ' +
        'Use get_usual to recall what they normally buy, build_cart to make a cart (fromUsual with scaleBy for parties), ' +
        'check_stock_and_substitute before ordering, place_order to send the order to each shop, which checks khata limits itself, and khata_balance to show store credit.',
    },
  );

  server.registerTool('find_shops', {
    title: 'Find shops', description: 'List the neighbourhood shops on Nukkad, optionally by type.',
    inputSchema: T.FindShopsArgs, annotations: { readOnlyHint: true },
  }, guard(async (a) => { const r = await T.findShops(a, storage); return result(r, `${r.count} shops`); }));

  server.registerTool('search_catalog', {
    title: 'Search catalog', description: 'Search products across all shops. Understands Hinglish names like atta, doodh, chini, chawal.',
    inputSchema: T.SearchCatalogArgs, annotations: { readOnlyHint: true },
  }, guard(async (a) => { const r = await T.searchCatalog(a, storage); return result(r, `${r.count} products for ${a.query}`); }));

  server.registerTool('get_usual', {
    title: 'Get usual order', description: "Recall the customer's usual weekly order across shops.",
    inputSchema: T.GetUsualArgs, annotations: { readOnlyHint: true },
  }, guard(async (a) => { const r = await T.getUsual(a, storage); return result(r, `${r.items.length} usual items`); }));

  server.registerTool('build_cart', {
    title: 'Build cart', description: 'Create the cart. Use fromUsual true and scaleBy to scale the usual order, for example scaleBy 3 for six guests. Extra items can be added by productId.',
    inputSchema: T.BuildCartArgs, _meta: ui('ui://nukkad/cart'),
  }, guard(async (a) => { const r = await T.buildCart(a, storage); return result(r, `Cart ${r.totalLabel} across ${r.byShop.length} shops`); }));

  server.registerTool('check_stock_and_substitute', {
    title: 'Check stock and substitute', description: 'Check live stock for every cart item and swap anything short for the best substitute, possibly from another shop.',
    inputSchema: T.CheckStockArgs, _meta: ui('ui://nukkad/cart'),
  }, guard(async (a) => { const r = await T.checkStockAndSubstitute(a, storage); return result(r, `${r.substitutions.length} substitutions, total ${r.totalLabel}`); }));

  server.registerTool('khata_balance', {
    title: 'Khata balance', description: 'Show khata (store credit) due and available credit at each shop.',
    inputSchema: T.KhataBalanceArgs, annotations: { readOnlyHint: true }, _meta: ui('ui://nukkad/khata'),
  }, guard(async (a) => { const r = await T.khataBalance(a, storage); return result(r, `Total due ${r.totalDue}`); }));

  server.registerTool('place_order', {
    title: 'Place order', description: 'Send the cart to each shop as a separate order. Payment by khata, cash or upi. Checks khata limits first.',
    inputSchema: T.PlaceOrderArgs, _meta: ui('ui://nukkad/order-tracker'),
  }, guard(async (a) => { const r = await T.placeOrder(a, storage); return result(r, `${r.count} orders placed, total ${r.totalLabel}`); }));

  server.registerTool('track_order', {
    title: 'Track order', description: "Track the customer's latest orders or one order by id.",
    inputSchema: T.TrackOrderArgs, annotations: { readOnlyHint: true }, _meta: ui('ui://nukkad/order-tracker'),
  }, guard(async (a) => { const r = await T.trackOrder(a, storage); return result(r, `${r.count} orders`); }));

  server.registerTool('khata_add_entry', {
    title: 'Add khata entry', description: 'Record a payment (credit) or a purchase (debit) on the khata.',
    inputSchema: T.KhataAddEntryArgs, _meta: ui('ui://nukkad/khata'),
  }, guard(async (a) => { const r = await T.khataAddEntry(a, storage); return result(r, `Recorded. Total due ${r.totalDue}`); }));

  for (const r of UI_RESOURCES) {
    server.registerResource(r.name, r.uri, { title: r.name, description: r.description, mimeType: MCP_APP_MIME },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: MCP_APP_MIME, text: r.html, _meta: { ui: { prefersBorder: false } } }] }));
  }

  server.registerPrompt('reorder-usual', {
    title: 'Reorder my usual', description: 'Reorder the usual basket on khata', argsSchema: { customerId: z.string() },
  }, ({ customerId }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Reorder my usual for ${customerId} and put it on my khata.` } }] }));

  server.registerPrompt('party-order', {
    title: 'Party order', description: 'Scale the usual basket for guests', argsSchema: { customerId: z.string(), guests: z.string() },
  }, ({ customerId, guests }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `I have ${guests} guests coming. Get my usual (${customerId}) scaled for them, check stock, and put it on my khata.` } }] }));

  return server;
}
