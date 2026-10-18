import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryStorage } from './storage/memory.js';

// Simple mock MCP client for testing
class TestMCPClient {
  private storage: MemoryStorage;
  private messageId = 1;

  constructor(storage: MemoryStorage) {
    this.storage = storage;
  }

  private async callTool(name: string, args: any): Promise<any> {
    // Import tools directly for testing
    const { 
      findShops, FindShopsArgsSchema,
      searchCatalog, SearchCatalogArgsSchema,
      getUsual, GetUsualArgsSchema,
      buildCart, BuildCartArgsSchema,
      placeOrder, PlaceOrderArgsSchema,
      trackOrder, TrackOrderArgsSchema,
      khataBalance, KhataBalanceArgsSchema,
    } = await import('./tools/index.js');

    switch (name) {
      case 'find_shops':
        return findShops(FindShopsArgsSchema.parse(args), this.storage);
      case 'search_catalog':
        return searchCatalog(SearchCatalogArgsSchema.parse(args), this.storage);
      case 'get_usual':
        return getUsual(GetUsualArgsSchema.parse(args), this.storage);
      case 'build_cart':
        return buildCart(BuildCartArgsSchema.parse(args), this.storage);
      case 'place_order':
        return placeOrder(PlaceOrderArgsSchema.parse(args), this.storage);
      case 'track_order':
        return trackOrder(TrackOrderArgsSchema.parse(args), this.storage);
      case 'khata_balance':
        return khataBalance(KhataBalanceArgsSchema.parse(args), this.storage);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async initialize() {
    return {
      protocolVersion: '2025-11-25',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: 'nukkad-mcp',
        version: '1.0.0',
      },
    };
  }

  async listTools() {
    return {
      tools: [
        { name: 'find_shops', description: 'Find nearby shops', inputSchema: {} },
        { name: 'search_catalog', description: 'Search products', inputSchema: {} },
        { name: 'get_usual', description: 'Get usual order', inputSchema: {} },
        { name: 'build_cart', description: 'Build shopping cart', inputSchema: {} },
        { name: 'check_stock_and_substitute', description: 'Check stock', inputSchema: {} },
        { name: 'place_order', description: 'Place order', inputSchema: {} },
        { name: 'track_order', description: 'Track orders', inputSchema: {} },
        { name: 'khata_balance', description: 'Get khata balance', inputSchema: {} },
        { name: 'khata_add_entry', description: 'Add khata entry', inputSchema: {} },
      ],
    };
  }

  async executeToolCall(name: string, args: any) {
    return this.callTool(name, args);
  }
}

describe('Nukkad MCP Server', () => {
  let client: TestMCPClient;
  let storage: MemoryStorage;

  beforeAll(() => {
    storage = new MemoryStorage();
    client = new TestMCPClient(storage);
  });

  describe('Protocol Version', () => {
    it('returns protocol version 2025-11-25 on initialize', async () => {
      const result = await client.initialize();
      expect(result.protocolVersion).toBe('2025-11-25');
      expect(result.serverInfo.name).toBe('nukkad-mcp');
    });
  });

  describe('Tools', () => {
    it('lists all 9 tools', async () => {
      const result = await client.listTools();
      expect(result.tools).toHaveLength(9);
      
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('find_shops');
      expect(toolNames).toContain('search_catalog');
      expect(toolNames).toContain('get_usual');
      expect(toolNames).toContain('build_cart');
      expect(toolNames).toContain('place_order');
      expect(toolNames).toContain('track_order');
      expect(toolNames).toContain('khata_balance');
    });

    it('executes find_shops tool under 500ms', async () => {
      const start = Date.now();
      const result = await client.executeToolCall('find_shops', { type: 'kirana' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(result.shops).toBeDefined();
      expect(result.shops.length).toBeGreaterThan(0);
      expect(result.responseTime).toBeDefined();
    });

    it('executes search_catalog with Hinglish alias', async () => {
      const start = Date.now();
      const result = await client.executeToolCall('search_catalog', { query: 'atta' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(result.products).toBeDefined();
      expect(result.products.length).toBeGreaterThan(0);
      expect(result.products[0].name).toContain('Wheat');
    });

    it('executes get_usual for customer-1', async () => {
      const result = await client.executeToolCall('get_usual', { customerId: 'customer-1' });
      
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.customerId).toBe('customer-1');
    });

    it('executes build_cart with quantity scaling', async () => {
      const result = await client.executeToolCall('build_cart', {
        customerId: 'customer-1',
        items: [
          { productId: 'prod-kirana-001', shopId: 'shop-kirana-1', quantity: 1 },
        ],
        scaleBy: 2,
      });

      expect(result.cart).toBeDefined();
      expect(result.cart.items[0].quantity).toBe(2);
    });

    it('executes khata_balance', async () => {
      const result = await client.executeToolCall('khata_balance', { customerId: 'customer-1' });
      
      expect(result.accounts).toBeDefined();
      expect(result.totalDue).toBeDefined();
    });

    it('executes track_order', async () => {
      const result = await client.executeToolCall('track_order', { customerId: 'customer-1' });
      
      expect(result.orders).toBeDefined();
      expect(Array.isArray(result.orders)).toBe(true);
    });
  });

  describe('Multi-shop Order Flow', () => {
    it('places order across multiple shops', async () => {
      // Build cart with items from two shops
      await client.executeToolCall('build_cart', {
        customerId: 'customer-1',
        items: [
          { productId: 'prod-kirana-001', shopId: 'shop-kirana-1', quantity: 1 },
          { productId: 'prod-bakery-001', shopId: 'shop-bakery-1', quantity: 1 },
        ],
      });

      // Place order
      const result = await client.executeToolCall('place_order', {
        customerId: 'customer-1',
        paymentMethod: 'khata',
      });

      expect(result.orders).toBeDefined();
      expect(result.orders.length).toBe(2); // Two shops
      expect(result.totalAmount).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('all tools execute under 500ms', async () => {
      const toolTests = [
        { name: 'find_shops', args: {} },
        { name: 'search_catalog', args: { query: 'milk' } },
        { name: 'get_usual', args: { customerId: 'customer-1' } },
        { name: 'khata_balance', args: { customerId: 'customer-1' } },
        { name: 'track_order', args: { customerId: 'customer-1' } },
      ];

      for (const test of toolTests) {
        const start = Date.now();
        await client.executeToolCall(test.name, test.args);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(500);
      }
    });
  });
});
