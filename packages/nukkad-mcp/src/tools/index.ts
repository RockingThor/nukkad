import { z } from 'zod';
import type { StorageLayer } from '../storage/interface.js';

export const FindShopsArgsSchema = z.object({
  type: z.enum(['kirana', 'bakery', 'dairy', 'vegetable', 'all']).optional(),
  near: z.string().optional(),
});

export async function findShops(
  args: z.infer<typeof FindShopsArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  let shops = await storage.getShops();

  if (args.type && args.type !== 'all') {
    shops = shops.filter(s => s.type === args.type);
  }

  const duration = Date.now() - startTime;
  
  return {
    shops: shops.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      address: s.address,
      phone: s.phone,
      openHours: s.openHours,
    })),
    count: shops.length,
    responseTime: `${duration}ms`,
  };
}

export const SearchCatalogArgsSchema = z.object({
  query: z.string(),
  shopIds: z.array(z.string()).optional(),
  limit: z.number().optional().default(20),
});

export async function searchCatalog(
  args: z.infer<typeof SearchCatalogArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  let products = await storage.searchProducts(args.query, args.shopIds);

  if (args.limit && products.length > args.limit) {
    products = products.slice(0, args.limit);
  }

  const duration = Date.now() - startTime;

  return {
    products: products.map(p => ({
      id: p.id,
      shopId: p.shopId,
      name: p.name,
      category: p.category,
      price: p.price,
      unit: p.unit,
      stock: p.stock,
      inStock: p.stock > 0,
    })),
    count: products.length,
    query: args.query,
    responseTime: `${duration}ms`,
  };
}

export const GetUsualArgsSchema = z.object({
  customerId: z.string(),
});

export async function getUsual(
  args: z.infer<typeof GetUsualArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  const customer = await storage.getCustomer(args.customerId);

  if (!customer || !customer.usualOrder) {
    return {
      items: [],
      message: 'No usual order found',
      responseTime: `${Date.now() - startTime}ms`,
    };
  }

  const items = await Promise.all(
    customer.usualOrder.map(async (item) => {
      const product = await storage.getProduct(item.productId);
      const shop = await storage.getShop(item.shopId);
      
      return {
        productId: item.productId,
        productName: product?.name || 'Unknown',
        shopId: item.shopId,
        shopName: shop?.name || 'Unknown',
        quantity: item.quantity,
        price: product?.price || 0,
        unit: product?.unit || '',
        inStock: (product?.stock || 0) > 0,
      };
    })
  );

  const duration = Date.now() - startTime;

  return {
    customerId: args.customerId,
    items,
    totalItems: items.length,
    responseTime: `${duration}ms`,
  };
}

export const BuildCartArgsSchema = z.object({
  customerId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    shopId: z.string(),
    quantity: z.number(),
  })),
  scaleBy: z.number().optional().default(1),
});

export async function buildCart(
  args: z.infer<typeof BuildCartArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  const cartItems = await Promise.all(
    args.items.map(async (item: { productId: string; shopId: string; quantity: number }) => {
      const product = await storage.getProduct(item.productId);
      
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const scaledQuantity = Math.ceil(item.quantity * args.scaleBy);

      return {
        productId: item.productId,
        shopId: item.shopId,
        quantity: scaledQuantity,
        price: product.price,
        productName: product.name,
      };
    })
  );

  const cart = {
    customerId: args.customerId,
    items: cartItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await storage.saveCart(cart);

  const duration = Date.now() - startTime;

  const total = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  return {
    cart: {
      customerId: args.customerId,
      items: cartItems,
      total,
      itemCount: cartItems.length,
    },
    message: `Cart built with ${cartItems.length} items. Total: ₹${total}`,
    responseTime: `${duration}ms`,
  };
}

export const CheckStockAndSubstituteArgsSchema = z.object({
  customerId: z.string(),
  autoSubstitute: z.boolean().optional().default(false),
});

export async function checkStockAndSubstitute(
  args: z.infer<typeof CheckStockAndSubstituteArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  const cart = await storage.getCart(args.customerId);

  if (!cart) {
    return {
      available: [],
      outOfStock: [],
      substitutions: [],
      message: 'No cart found',
      responseTime: `${Date.now() - startTime}ms`,
    };
  }

  const available = [];
  const outOfStock = [];
  const substitutions = [];

  for (const item of cart.items) {
    const product = await storage.getProduct(item.productId);

    if (!product) {
      outOfStock.push({
        ...item,
        reason: 'Product not found',
      });
      continue;
    }

    if (product.stock >= item.quantity) {
      available.push(item);
    } else {
      const similarProducts = await storage.searchProducts(
        product.category,
        [item.shopId]
      );

      const substitute = similarProducts.find(
        p => p.id !== item.productId && p.stock >= item.quantity
      );

      if (substitute && args.autoSubstitute) {
        substitutions.push({
          original: {
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
          },
          substitute: {
            productId: substitute.id,
            productName: substitute.name,
            price: substitute.price,
            quantity: item.quantity,
          },
        });

        available.push({
          productId: substitute.id,
          shopId: item.shopId,
          quantity: item.quantity,
          price: substitute.price,
          productName: substitute.name,
        });
      } else {
        outOfStock.push({
          ...item,
          availableStock: product.stock,
          suggestedSubstitute: substitute
            ? {
                productId: substitute.id,
                productName: substitute.name,
                price: substitute.price,
              }
            : null,
        });
      }
    }
  }

  if (substitutions.length > 0) {
    await storage.saveCart({
      ...cart,
      items: available,
      updatedAt: new Date().toISOString(),
    });
  }

  const duration = Date.now() - startTime;

  return {
    available,
    outOfStock,
    substitutions,
    needsConfirmation: outOfStock.length > 0 && !args.autoSubstitute,
    message:
      outOfStock.length === 0
        ? 'All items available'
        : `${outOfStock.length} item(s) need attention`,
    responseTime: `${duration}ms`,
  };
}

export const PlaceOrderArgsSchema = z.object({
  customerId: z.string(),
  paymentMethod: z.enum(['cash', 'khata', 'upi']),
  shopId: z.string().optional(),
});

export async function placeOrder(
  args: z.infer<typeof PlaceOrderArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  const cart = await storage.getCart(args.customerId);

  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const customer = await storage.getCustomer(args.customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  let itemsByShop = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const shopItems = itemsByShop.get(item.shopId) || [];
    shopItems.push(item);
    itemsByShop.set(item.shopId, shopItems);
  }

  if (args.shopId) {
    const filtered = itemsByShop.get(args.shopId);
    if (!filtered) {
      throw new Error(`No items for shop ${args.shopId}`);
    }
    itemsByShop = new Map([[args.shopId, filtered]]);
  }

  const orders = [];

  for (const [shopId, items] of itemsByShop) {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (args.paymentMethod === 'khata') {
      const khataAccount = await storage.getKhataAccount(args.customerId, shopId);
      const newBalance = (khataAccount?.balance || 0) - total;

      if (khataAccount && Math.abs(newBalance) > khataAccount.creditLimit) {
        throw new Error(
          `Credit limit exceeded for ${shopId}. Available credit: ₹${
            khataAccount.creditLimit - Math.abs(khataAccount.balance)
          }`
        );
      }
    }

    const order = await storage.createOrder({
      customerId: args.customerId,
      shopId,
      items,
      total,
      status: 'pending',
      paymentMethod: args.paymentMethod,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliveryAddress: customer.address,
    });

    for (const item of items) {
      const product = await storage.getProduct(item.productId);
      if (product) {
        await storage.updateProductStock(item.productId, product.stock - item.quantity);
      }
    }

    if (args.paymentMethod === 'khata') {
      await storage.updateKhataBalance(args.customerId, shopId, -total);
      await storage.addKhataEntry({
        customerId: args.customerId,
        shopId,
        amount: total,
        type: 'debit',
        description: `Order ${order.id}`,
        orderId: order.id,
        date: new Date().toISOString(),
      });
    }

    orders.push(order);
  }

  await storage.clearCart(args.customerId);

  const duration = Date.now() - startTime;

  return {
    orders: orders.map(o => ({
      orderId: o.id,
      shopId: o.shopId,
      total: o.total,
      status: o.status,
      itemCount: o.items.length,
    })),
    totalAmount: orders.reduce((sum, o) => sum + o.total, 0),
    paymentMethod: args.paymentMethod,
    message: `${orders.length} order(s) placed successfully`,
    responseTime: `${duration}ms`,
  };
}

export const TrackOrderArgsSchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
});

export async function trackOrder(
  args: z.infer<typeof TrackOrderArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  let orders: any[] = [];

  if (args.orderId) {
    const order = await storage.getOrder(args.orderId);
    if (order) {
      orders = [order];
    }
  } else if (args.customerId) {
    const customerOrders = await storage.getCustomerOrders(args.customerId);
    orders = customerOrders.slice(0, 5);
  } else {
    throw new Error('Either orderId or customerId is required');
  }

  const duration = Date.now() - startTime;

  return {
    orders: orders.map(o => ({
      orderId: o.id,
      shopId: o.shopId,
      status: o.status,
      total: o.total,
      itemCount: o.items.length,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
    count: orders.length,
    responseTime: `${duration}ms`,
  };
}

export const KhataBalanceArgsSchema = z.object({
  customerId: z.string(),
  shopId: z.string().optional(),
});

export async function khataBalance(
  args: z.infer<typeof KhataBalanceArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  const shops = args.shopId ? [args.shopId] : (await storage.getShops()).map(s => s.id);

  const accounts = await Promise.all(
    shops.map(async (shopId) => {
      const account = await storage.getKhataAccount(args.customerId, shopId);
      if (!account) return null;

      const shop = await storage.getShop(shopId);

      return {
        shopId,
        shopName: shop?.name || 'Unknown',
        balance: account.balance,
        creditLimit: account.creditLimit,
        availableCredit: account.creditLimit - Math.abs(account.balance),
        lastUpdated: account.lastUpdated,
      };
    })
  );

  const validAccounts = accounts.filter(a => a !== null);

  const duration = Date.now() - startTime;

  return {
    customerId: args.customerId,
    accounts: validAccounts,
    totalDue: validAccounts.reduce((sum, a) => sum + Math.abs(Math.min(a!.balance, 0)), 0),
    responseTime: `${duration}ms`,
  };
}

export const KhataAddEntryArgsSchema = z.object({
  customerId: z.string(),
  shopId: z.string(),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
  description: z.string(),
});

export async function khataAddEntry(
  args: z.infer<typeof KhataAddEntryArgsSchema>,
  storage: StorageLayer
) {
  const startTime = Date.now();
  
  const entry = await storage.addKhataEntry({
    ...args,
    date: new Date().toISOString(),
  });

  const balanceChange = args.type === 'debit' ? -args.amount : args.amount;
  await storage.updateKhataBalance(args.customerId, args.shopId, balanceChange);

  const account = await storage.getKhataAccount(args.customerId, args.shopId);

  const duration = Date.now() - startTime;

  return {
    entry: {
      id: entry.id,
      amount: entry.amount,
      type: entry.type,
      description: entry.description,
      date: entry.date,
    },
    newBalance: account?.balance || 0,
    availableCredit: account ? account.creditLimit - Math.abs(account.balance) : 0,
    responseTime: `${duration}ms`,
  };
}
