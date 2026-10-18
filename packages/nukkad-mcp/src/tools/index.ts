import { z } from 'zod';
import type { StorageLayer } from '../storage/interface.js';
import type { CartItem, Order } from '../types.js';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// ---------- find_shops ----------
export const FindShopsArgs = {
  type: z.enum(['kirana', 'bakery', 'dairy', 'vegetable', 'all']).optional().describe('Kind of shop'),
};
export async function findShops(args: { type?: string }, storage: StorageLayer) {
  let shops = await storage.getShops();
  if (args.type && args.type !== 'all') shops = shops.filter((s) => s.type === args.type);
  return { shops, count: shops.length };
}

// ---------- search_catalog ----------
export const SearchCatalogArgs = {
  query: z.string().describe('Product name or Hinglish alias, for example atta, doodh, chini'),
  shopIds: z.array(z.string()).optional().describe('Limit to these shop ids'),
  limit: z.number().int().positive().max(50).optional(),
};
export async function searchCatalog(args: { query: string; shopIds?: string[]; limit?: number }, storage: StorageLayer) {
  const all = await storage.searchProducts(args.query, args.shopIds);
  const shops = new Map((await storage.getShops()).map((s) => [s.id, s.name]));
  const products = all.slice(0, args.limit ?? 10).map((p) => ({
    productId: p.id, shopId: p.shopId, shopName: shops.get(p.shopId), name: p.name,
    price: p.price, unit: p.unit, stock: p.stock, inStock: p.stock > 0,
  }));
  return { query: args.query, products, count: products.length };
}

// ---------- get_usual ----------
export const GetUsualArgs = { customerId: z.string().describe('Customer id, for example customer-1') };
export async function getUsual(args: { customerId: string }, storage: StorageLayer) {
  const customer = await storage.getCustomer(args.customerId);
  if (!customer) throw new Error(`Unknown customer ${args.customerId}`);
  const items = [];
  for (const u of customer.usualOrder ?? []) {
    const p = await storage.getProduct(u.productId);
    const s = await storage.getShop(u.shopId);
    if (p) items.push({ productId: p.id, name: p.name, shopId: u.shopId, shopName: s?.name, quantity: u.quantity, unit: p.unit, price: p.price });
  }
  return { customerId: customer.id, customerName: customer.name, items, estimatedTotal: items.reduce((a, i) => a + i.price * i.quantity, 0) };
}

// ---------- build_cart ----------
export const BuildCartArgs = {
  customerId: z.string(),
  fromUsual: z.boolean().optional().describe("Start from the customer's usual order"),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().positive() })).optional()
    .describe('Extra items to add, by productId from search_catalog or get_usual'),
  scaleBy: z.number().positive().max(20).optional().describe('Multiply quantities of the usual order, for example 3 for a party of six'),
};
export async function buildCart(
  args: { customerId: string; fromUsual?: boolean; items?: { productId: string; quantity: number }[]; scaleBy?: number },
  storage: StorageLayer,
) {
  const scale = args.scaleBy ?? 1;
  const wanted: { productId: string; quantity: number }[] = [];
  if (args.fromUsual || !args.items?.length) {
    const c = await storage.getCustomer(args.customerId);
    for (const u of c?.usualOrder ?? []) wanted.push({ productId: u.productId, quantity: Math.ceil(u.quantity * scale) });
  }
  for (const i of args.items ?? []) {
    const ex = wanted.find((w) => w.productId === i.productId);
    if (ex) ex.quantity = Math.max(ex.quantity, Math.ceil(i.quantity)); else wanted.push({ productId: i.productId, quantity: Math.ceil(i.quantity) });
  }
  const items: CartItem[] = [];
  for (const w of wanted) {
    const p = await storage.getProduct(w.productId);
    if (!p) continue;
    items.push({ productId: p.id, shopId: p.shopId, quantity: w.quantity, price: p.price, productName: p.name });
  }
  const now = new Date().toISOString();
  await storage.saveCart({ customerId: args.customerId, items, createdAt: now, updatedAt: now });
  return cartView(args.customerId, items, storage, scale > 1 ? `Scaled ${scale}x for the party` : undefined);
}

export async function cartView(customerId: string, items: CartItem[], storage: StorageLayer, note?: string, substitutions: any[] = []) {
  const shops = new Map((await storage.getShops()).map((s) => [s.id, s.name]));
  const groups = new Map<string, CartItem[]>();
  for (const i of items) groups.set(i.shopId, [...(groups.get(i.shopId) ?? []), i]);
  const byShop = [...groups].map(([shopId, its]) => ({
    shopId, shopName: shops.get(shopId), subtotal: its.reduce((a, i) => a + i.price * i.quantity, 0),
    items: its.map((i) => ({ productId: i.productId, name: i.productName, quantity: i.quantity, price: i.price, lineTotal: i.price * i.quantity })),
  }));
  const total = byShop.reduce((a, s) => a + s.subtotal, 0);
  return { customerId, note, byShop, substitutions, total, totalLabel: rupees(total), itemCount: items.length };
}

// ---------- check_stock_and_substitute ----------
export const CheckStockArgs = {
  customerId: z.string(),
  autoSubstitute: z.boolean().optional().describe('Swap short items for the best substitute. Defaults to true'),
};
export async function checkStockAndSubstitute(args: { customerId: string; autoSubstitute?: boolean }, storage: StorageLayer) {
  const cart = await storage.getCart(args.customerId);
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty. Call build_cart first.');
  const auto = args.autoSubstitute ?? true;
  const out: CartItem[] = [];
  const substitutions: any[] = [];
  const shortages: any[] = [];
  for (const item of cart.items) {
    const p = await storage.getProduct(item.productId);
    if (p && p.stock >= item.quantity) { out.push(item); continue; }
    // candidates: explicit substitutes first, then same category anywhere with stock
    const cands = [];
    for (const id of p?.substitutes ?? []) { const s = await storage.getProduct(id); if (s) cands.push(s); }
    if (p) for (const s of await storage.searchProducts(p.category)) if (s.id !== p.id && !cands.find((c) => c.id === s.id)) cands.push(s);
    const sub = cands.find((s) => s.stock >= item.quantity);
    if (sub && auto) {
      const shop = await storage.getShop(sub.shopId);
      substitutions.push({ original: p?.name ?? item.productName, originalStock: p?.stock ?? 0, substitute: sub.name, substituteShop: shop?.name, quantity: item.quantity });
      out.push({ productId: sub.id, shopId: sub.shopId, quantity: item.quantity, price: sub.price, productName: sub.name });
    } else {
      shortages.push({ name: item.productName, wanted: item.quantity, available: p?.stock ?? 0, suggestion: sub?.name });
      if (p && p.stock > 0) out.push({ ...item, quantity: p.stock });
    }
  }
  await storage.saveCart({ ...cart, items: out, updatedAt: new Date().toISOString() });
  const view = await cartView(args.customerId, out, storage, substitutions.length ? `${substitutions.length} ${substitutions.length === 1 ? 'substitution' : 'substitutions'} made` : 'Everything is in stock', substitutions);
  return { ...view, shortages, allAvailable: shortages.length === 0 };
}

// ---------- khata_balance ----------
export const KhataBalanceArgs = { customerId: z.string(), shopId: z.string().optional() };
export async function khataBalance(args: { customerId: string; shopId?: string }, storage: StorageLayer) {
  const shops = await storage.getShops();
  const accounts = [];
  for (const s of shops) {
    if (args.shopId && s.id !== args.shopId) continue;
    const a = await storage.getKhataAccount(args.customerId, s.id);
    if (!a) continue;
    const entries = (await storage.getKhataEntries(args.customerId, s.id)).slice(-5).reverse();
    const due = Math.max(0, -a.balance);
    accounts.push({ shopId: s.id, shopName: s.name, due, creditLimit: a.creditLimit, availableCredit: a.creditLimit - due, entries });
  }
  return { customerId: args.customerId, accounts, totalDue: accounts.reduce((x, a) => x + a.due, 0) };
}

// ---------- place_order ----------
export const PlaceOrderArgs = {
  customerId: z.string(),
  paymentMethod: z.enum(['cash', 'khata', 'upi']).describe('khata puts it on store credit'),
  deliverBy: z.string().optional().describe('When to deliver, free text, for example Saturday 5 PM'),
};
export async function placeOrder(args: { customerId: string; paymentMethod: Order['paymentMethod']; deliverBy?: string }, storage: StorageLayer) {
  const cart = await storage.getCart(args.customerId);
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty. Call build_cart first.');
  const customer = await storage.getCustomer(args.customerId);
  if (!customer) throw new Error('Customer not found');
  const groups = new Map<string, CartItem[]>();
  for (const i of cart.items) groups.set(i.shopId, [...(groups.get(i.shopId) ?? []), i]);

  // Validate credit for every shop before writing anything.
  if (args.paymentMethod === 'khata') {
    for (const [shopId, items] of groups) {
      const total = items.reduce((a, i) => a + i.price * i.quantity, 0);
      const acc = await storage.getKhataAccount(args.customerId, shopId);
      const due = acc ? Math.max(0, -acc.balance) : 0;
      const limit = acc?.creditLimit ?? 3000;
      if (due + total > limit) {
        const shop = await storage.getShop(shopId);
        throw new Error(`Khata limit reached at ${shop?.name}. Available credit ${rupees(limit - due)}, order needs ${rupees(total)}.`);
      }
    }
  }
  const orders = [];
  const now = new Date().toISOString();
  for (const [shopId, items] of groups) {
    const total = items.reduce((a, i) => a + i.price * i.quantity, 0);
    const order = await storage.createOrder({
      customerId: args.customerId, customerName: customer.name, shopId, items, total, status: 'pending',
      paymentMethod: args.paymentMethod, createdAt: now, updatedAt: now, deliveryAddress: customer.address, deliverBy: args.deliverBy,
    });
    for (const i of items) {
      const p = await storage.getProduct(i.productId);
      if (p) await storage.updateProductStock(p.id, Math.max(0, p.stock - i.quantity));
    }
    if (args.paymentMethod === 'khata') {
      await storage.updateKhataBalance(args.customerId, shopId, -total);
      await storage.addKhataEntry({ customerId: args.customerId, shopId, amount: total, type: 'debit', description: `Order ${order.id}`, orderId: order.id, date: now });
    }
    orders.push(order);
  }
  await storage.clearCart(args.customerId);
  return trackView(orders, storage);
}

async function trackView(orders: Order[], storage: StorageLayer) {
  const shops = new Map((await storage.getShops()).map((s) => [s.id, s.name]));
  const view = orders.map((o) => ({
    orderId: o.id, shopId: o.shopId, shopName: shops.get(o.shopId), status: o.status, total: o.total,
    paymentMethod: o.paymentMethod, itemCount: o.items.length, deliverBy: o.deliverBy, createdAt: o.createdAt, updatedAt: o.updatedAt,
    items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
  }));
  const total = view.reduce((a, o) => a + o.total, 0);
  return { orders: view, count: view.length, total, totalLabel: rupees(total) };
}

// ---------- track_order ----------
export const TrackOrderArgs = { customerId: z.string().optional(), orderId: z.string().optional() };
export async function trackOrder(args: { customerId?: string; orderId?: string }, storage: StorageLayer) {
  let orders: Order[] = [];
  if (args.orderId) { const o = await storage.getOrder(args.orderId); if (o) orders = [o]; }
  else if (args.customerId) {
    const all = await storage.getCustomerOrders(args.customerId);
    const latest = all[0]?.createdAt;
    orders = all.filter((o) => o.createdAt === latest);
    if (orders.length === 0) orders = all.slice(0, 3);
  } else throw new Error('Pass customerId or orderId');
  return trackView(orders, storage);
}

// ---------- khata_add_entry ----------
export const KhataAddEntryArgs = {
  customerId: z.string(), shopId: z.string(), amount: z.number().positive(),
  type: z.enum(['debit', 'credit']).describe('credit means the customer paid'), description: z.string(),
};
export async function khataAddEntry(args: { customerId: string; shopId: string; amount: number; type: 'debit' | 'credit'; description: string }, storage: StorageLayer) {
  await storage.addKhataEntry({ ...args, date: new Date().toISOString() });
  await storage.updateKhataBalance(args.customerId, args.shopId, args.type === 'debit' ? -args.amount : args.amount);
  return khataBalance({ customerId: args.customerId }, storage);
}

// ---------- shop side (used by the shop console REST routes) ----------
export async function shopDashboard(shopId: string, storage: StorageLayer) {
  const shop = await storage.getShop(shopId);
  if (!shop) throw new Error('Unknown shop');
  const orders = await storage.getShopOrders(shopId);
  const products = await storage.getProducts(shopId);
  const lowStock = products.filter((p) => p.stock < 8).map((p) => ({ name: p.name, stock: p.stock, unit: p.unit }));
  const today = new Date().toISOString().slice(0, 10);
  const todays = orders.filter((o) => o.createdAt.startsWith(today));
  return {
    shop, orders, lowStock,
    stats: {
      ordersToday: todays.length,
      revenueToday: todays.reduce((a, o) => a + o.total, 0),
      open: orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
      onKhata: todays.filter((o) => o.paymentMethod === 'khata').reduce((a, o) => a + o.total, 0),
    },
  };
}
