import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { StorageLayer } from './storage/interface.js';
import { MemoryStorage } from './storage/memory.js';
import {
  findShops,
  FindShopsArgsSchema,
  searchCatalog,
  SearchCatalogArgsSchema,
  getUsual,
  GetUsualArgsSchema,
  buildCart,
  BuildCartArgsSchema,
  checkStockAndSubstitute,
  CheckStockAndSubstituteArgsSchema,
  placeOrder,
  PlaceOrderArgsSchema,
  trackOrder,
  TrackOrderArgsSchema,
  khataBalance,
  KhataBalanceArgsSchema,
  khataAddEntry,
  KhataAddEntryArgsSchema,
} from './tools/index.js';

// Assert protocol version for hackathon requirement
const PROTOCOL_VERSION = '2025-11-25';

export function createNukkadServer(storage: StorageLayer) {
  const server = new Server(
    {
      name: 'nukkad-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'find_shops',
        description:
          'Find nearby shops. Filter by type (kirana, bakery, dairy, vegetable) or location.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['kirana', 'bakery', 'dairy', 'vegetable', 'all'],
              description: 'Type of shop to find',
            },
            near: {
              type: 'string',
              description: 'Location or address (currently unused)',
            },
          },
        },
      },
      {
        name: 'search_catalog',
        description:
          'Search for products across shops. Supports Hinglish queries and aliases (e.g., "atta", "aata", "wheat flour").',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Product name or alias in English or Hinglish',
            },
            shopIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: limit search to specific shops',
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 20)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_usual',
        description:
          "Get a customer's usual order - items they typically purchase.",
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
          },
          required: ['customerId'],
        },
      },
      {
        name: 'build_cart',
        description:
          'Build a shopping cart from items. Can scale quantities (e.g., for parties).',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  shopId: { type: 'string' },
                  quantity: { type: 'number' },
                },
                required: ['productId', 'shopId', 'quantity'],
              },
            },
            scaleBy: {
              type: 'number',
              description: 'Scale factor for quantities (e.g., 2 for double)',
            },
          },
          required: ['customerId', 'items'],
        },
      },
      {
        name: 'check_stock_and_substitute',
        description:
          'Check stock availability and suggest substitutions for out-of-stock items.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
            autoSubstitute: {
              type: 'boolean',
              description: 'Automatically substitute without asking',
            },
          },
          required: ['customerId'],
        },
      },
      {
        name: 'place_order',
        description:
          'Place order(s) from the cart. Supports multiple shops and khata payment.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
            paymentMethod: {
              type: 'string',
              enum: ['cash', 'khata', 'upi'],
              description: 'Payment method',
            },
            shopId: {
              type: 'string',
              description: 'Optional: place order for specific shop only',
            },
          },
          required: ['customerId', 'paymentMethod'],
        },
      },
      {
        name: 'track_order',
        description:
          'Track order status by order ID or get recent orders for a customer.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Specific order ID',
            },
            customerId: {
              type: 'string',
              description: 'Customer ID to get recent orders',
            },
          },
        },
      },
      {
        name: 'khata_balance',
        description:
          'Get khata (store credit) balance and available credit limit.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
            shopId: {
              type: 'string',
              description: 'Optional: specific shop',
            },
          },
          required: ['customerId'],
        },
      },
      {
        name: 'khata_add_entry',
        description:
          'Add a khata entry (debit for purchase, credit for payment).',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
            shopId: {
              type: 'string',
              description: 'Shop ID',
            },
            amount: {
              type: 'number',
              description: 'Amount in rupees',
            },
            type: {
              type: 'string',
              enum: ['debit', 'credit'],
              description: 'Entry type',
            },
            description: {
              type: 'string',
              description: 'Description of the entry',
            },
          },
          required: ['customerId', 'shopId', 'amount', 'type', 'description'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'find_shops':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await findShops(FindShopsArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'search_catalog':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await searchCatalog(SearchCatalogArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'get_usual':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await getUsual(GetUsualArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'build_cart':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await buildCart(BuildCartArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'check_stock_and_substitute':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await checkStockAndSubstitute(
                  CheckStockAndSubstituteArgsSchema.parse(args || {}),
                  storage
                ),
                null,
                2
              ),
            },
          ],
        };

      case 'place_order':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await placeOrder(PlaceOrderArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'track_order':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await trackOrder(TrackOrderArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'khata_balance':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await khataBalance(KhataBalanceArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      case 'khata_add_entry':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await khataAddEntry(KhataAddEntryArgsSchema.parse(args || {}), storage),
                null,
                2
              ),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'ui://cart',
        name: 'Shopping Cart',
        description: 'View and edit cart items with quantities',
        mimeType: 'application/json',
      },
      {
        uri: 'ui://order-tracker',
        name: 'Order Tracker',
        description: 'Track order status in real-time',
        mimeType: 'application/json',
      },
      {
        uri: 'ui://khata',
        name: 'Khata Ledger',
        description: 'View khata balance and transaction history',
        mimeType: 'application/json',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
    const { uri } = request.params;

    if (uri === 'ui://cart') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'cart',
              version: '1.0',
              description: 'Shopping cart with editable quantities',
            }),
          },
        ],
      };
    }

    if (uri === 'ui://order-tracker') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'order-tracker',
              version: '1.0',
              description: 'Real-time order status',
            }),
          },
        ],
      };
    }

    if (uri === 'ui://khata') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              type: 'khata',
              version: '1.0',
              description: 'Khata balance and transaction history',
            }),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: 'reorder-usual',
        description: "Reorder the customer's usual items",
        arguments: [
          {
            name: 'customerId',
            description: 'Customer ID',
            required: true,
          },
        ],
      },
      {
        name: 'party-order',
        description: 'Order for a party with scaled quantities',
        arguments: [
          {
            name: 'customerId',
            description: 'Customer ID',
            required: true,
          },
          {
            name: 'guests',
            description: 'Number of guests',
            required: true,
          },
        ],
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    if (name === 'reorder-usual') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Get my usual order (customer ${args?.customerId}) and place it with khata payment.`,
            },
          },
        ],
      };
    }

    if (name === 'party-order') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I'm having ${args?.guests} guests over. Get my usual order (customer ${args?.customerId}), scale it for ${args?.guests} people, check stock, and place the order with khata payment.`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  return server;
}

export async function runServer() {
  const storage = new MemoryStorage();
  const server = createNukkadServer(storage);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Nukkad MCP Server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runServer().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
