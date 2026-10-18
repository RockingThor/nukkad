import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createNukkadServer } from './index.js';
import { MemoryStorage } from './storage/memory.js';

async function connect() {
  const server = createNukkadServer(new MemoryStorage());
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const sc = (r: any) => r.structuredContent;

describe('nukkad mcp', () => {
  it('lists tools with MCP Apps ui resources', async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['get_usual', 'build_cart', 'check_stock_and_substitute', 'place_order', 'khata_balance']));
    expect((tools.find((t) => t.name === 'build_cart')!._meta as any).ui.resourceUri).toBe('ui://nukkad/cart');
    const res = await c.readResource({ uri: 'ui://nukkad/cart' });
    expect(res.contents[0].mimeType).toBe('text/html;profile=mcp-app');
  });

  it('understands Hinglish search', async () => {
    const c = await connect();
    const r = sc(await c.callTool({ name: 'search_catalog', arguments: { query: 'atta' } }));
    expect(r.products[0].name).toBe('Wheat Flour');
  });

  it('runs the party flow: usual, scale, substitute, khata order across shops', async () => {
    const c = await connect();
    const usual = sc(await c.callTool({ name: 'get_usual', arguments: { customerId: 'customer-1' } }));
    expect(usual.items.length).toBe(6);
    const cart = sc(await c.callTool({ name: 'build_cart', arguments: { customerId: 'customer-1', fromUsual: true, scaleBy: 3 } }));
    expect(cart.byShop.length).toBe(3);
    const checked = sc(await c.callTool({ name: 'check_stock_and_substitute', arguments: { customerId: 'customer-1' } }));
    expect(checked.substitutions[0].original).toBe('Biscuits');
    expect(checked.substitutions[0].substitute).toBe('Cake Rusk');
    const placed = sc(await c.callTool({ name: 'place_order', arguments: { customerId: 'customer-1', paymentMethod: 'khata', deliverBy: 'Saturday 5 PM' } }));
    expect(placed.count).toBe(3);
    const khata = sc(await c.callTool({ name: 'khata_balance', arguments: { customerId: 'customer-1' } }));
    expect(khata.totalDue).toBe(810 + placed.total);
    const tracked = sc(await c.callTool({ name: 'track_order', arguments: { customerId: 'customer-1' } }));
    expect(tracked.count).toBe(3);
  });

  it('refuses khata orders over the credit limit', async () => {
    const c = await connect();
    await c.callTool({ name: 'build_cart', arguments: { customerId: 'customer-1', items: [{ productId: 'prod-dairy-005', quantity: 9 }] } });
    const r: any = await c.callTool({ name: 'place_order', arguments: { customerId: 'customer-1', paymentMethod: 'khata' } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('Khata limit');
  });
});
