import { describe, it, expect } from 'vitest';
import { createNukkadServer } from './index.js';
import { MemoryStorage } from './storage/memory.js';

describe('Nukkad MCP Server', () => {
  it('initializes with correct protocol version', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('initialize');
    expect(handler).toBeDefined();

    const result = await handler.call(server, {
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    });

    expect(result.protocolVersion).toBe('2025-11-25');
    expect(result.serverInfo.name).toBe('nukkad-mcp');
  });

  it('lists all tools', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('tools/list');
    const result = await handler.call(server, {});

    expect(result.tools).toHaveLength(9);
    expect(result.tools.map((t: any) => t.name)).toEqual([
      'find_shops',
      'search_catalog',
      'get_usual',
      'build_cart',
      'check_stock_and_substitute',
      'place_order',
      'track_order',
      'khata_balance',
      'khata_add_entry',
    ]);
  });

  it('lists MCP Apps resources', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('resources/list');
    const result = await handler.call(server, {});

    expect(result.resources).toHaveLength(3);
    expect(result.resources.map((r: any) => r.uri)).toEqual([
      'ui://cart',
      'ui://order-tracker',
      'ui://khata',
    ]);
  });

  it('lists prompts', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('prompts/list');
    const result = await handler.call(server, {});

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts.map((p: any) => p.name)).toEqual([
      'reorder-usual',
      'party-order',
    ]);
  });

  it('executes find_shops tool', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('tools/call');
    const result = await handler.call(server, {
      params: {
        name: 'find_shops',
        arguments: { type: 'kirana' },
      },
    });

    expect(result.content).toHaveLength(1);
    const data = JSON.parse(result.content[0].text);
    expect(data.shops).toBeDefined();
    expect(data.shops.length).toBeGreaterThan(0);
    expect(data.responseTime).toBeDefined();
  });

  it('executes search_catalog tool', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('tools/call');
    const result = await handler.call(server, {
      params: {
        name: 'search_catalog',
        arguments: { query: 'atta' },
      },
    });

    expect(result.content).toHaveLength(1);
    const data = JSON.parse(result.content[0].text);
    expect(data.products).toBeDefined();
    expect(data.products.length).toBeGreaterThan(0);
  });

  it('executes get_usual tool', async () => {
    const storage = new MemoryStorage();
    const server = createNukkadServer(storage);

    const handler = (server as any)._requestHandlers?.get('tools/call');
    const result = await handler.call(server, {
      params: {
        name: 'get_usual',
        arguments: { customerId: 'customer-1' },
      },
    });

    expect(result.content).toHaveLength(1);
    const data = JSON.parse(result.content[0].text);
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
  });
});
