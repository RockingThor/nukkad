import type { StorageLayer } from './interface.js';
import type {
  Shop,
  Product,
  Customer,
  Cart,
  Order,
  KhataEntry,
  KhataAccount,
} from '../types.js';
import { seedShops, seedProducts, seedCustomers } from '../data/seed.js';

export class MemoryStorage implements StorageLayer {
  private shops: Map<string, Shop>;
  private products: Map<string, Product>;
  private customers: Map<string, Customer>;
  private carts: Map<string, Cart>;
  private orders: Map<string, Order>;
  private khataAccounts: Map<string, KhataAccount>;
  private khataEntries: Map<string, KhataEntry[]>;
  private orderCounter: number = 1;
  private khataEntryCounter: number = 1;

  constructor() {
    this.shops = new Map(seedShops.map(s => [s.id, s]));
    this.products = new Map(seedProducts.map(p => [p.id, p]));
    this.customers = new Map(seedCustomers.map(c => [c.id, c]));
    this.carts = new Map();
    this.orders = new Map();
    this.khataAccounts = new Map();
    this.khataEntries = new Map();

    // Initialize khata accounts for customers with credit limits
    this.initializeKhataAccounts();
  }

  private initializeKhataAccounts() {
    // Customer 1 has khata accounts with two shops
    const customer1Id = 'customer-1';
    this.khataAccounts.set(`${customer1Id}:shop-kirana-1`, {
      customerId: customer1Id,
      shopId: 'shop-kirana-1',
      balance: -450,
      creditLimit: 5000,
      lastUpdated: new Date().toISOString(),
    });
    this.khataAccounts.set(`${customer1Id}:shop-bakery-1`, {
      customerId: customer1Id,
      shopId: 'shop-bakery-1',
      balance: -120,
      creditLimit: 2000,
      lastUpdated: new Date().toISOString(),
    });

    // Initialize some past khata entries
    this.khataEntries.set(`${customer1Id}:shop-kirana-1`, [
      {
        id: 'khata-001',
        customerId: customer1Id,
        shopId: 'shop-kirana-1',
        amount: 500,
        type: 'debit',
        description: 'Monthly groceries',
        date: '2026-10-01T10:00:00Z',
      },
      {
        id: 'khata-002',
        customerId: customer1Id,
        shopId: 'shop-kirana-1',
        amount: 50,
        type: 'credit',
        description: 'Payment received',
        date: '2026-10-10T15:30:00Z',
      },
    ]);

    this.khataEntries.set(`${customer1Id}:shop-bakery-1`, [
      {
        id: 'khata-003',
        customerId: customer1Id,
        shopId: 'shop-bakery-1',
        amount: 120,
        type: 'debit',
        description: 'Bread and snacks',
        date: '2026-10-05T09:00:00Z',
      },
    ]);
  }

  async getShops(): Promise<Shop[]> {
    return Array.from(this.shops.values());
  }

  async getShop(id: string): Promise<Shop | null> {
    return this.shops.get(id) || null;
  }

  async getProducts(shopId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => p.shopId === shopId);
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.products.get(productId) || null;
  }

  async searchProducts(query: string, shopIds?: string[]): Promise<Product[]> {
    const normalizedQuery = query.toLowerCase().trim();
    let products = Array.from(this.products.values());

    if (shopIds && shopIds.length > 0) {
      products = products.filter(p => shopIds.includes(p.shopId));
    }

    return products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(normalizedQuery);
      const aliasMatch = p.aliases.some(alias =>
        alias.toLowerCase().includes(normalizedQuery)
      );
      return nameMatch || aliasMatch;
    });
  }

  async updateProductStock(productId: string, newStock: number): Promise<void> {
    const product = this.products.get(productId);
    if (product) {
      product.stock = newStock;
    }
  }

  async getCustomer(id: string): Promise<Customer | null> {
    return this.customers.get(id) || null;
  }

  async updateCustomer(customer: Customer): Promise<void> {
    this.customers.set(customer.id, customer);
  }

  async getCart(customerId: string): Promise<Cart | null> {
    return this.carts.get(customerId) || null;
  }

  async saveCart(cart: Cart): Promise<void> {
    this.carts.set(cart.customerId, cart);
  }

  async clearCart(customerId: string): Promise<void> {
    this.carts.delete(customerId);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(o => o.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getShopOrders(shopId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(o => o.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createOrder(orderData: Omit<Order, 'id'>): Promise<Order> {
    const order: Order = {
      ...orderData,
      id: `order-${String(this.orderCounter++).padStart(6, '0')}`,
    };
    this.orders.set(order.id, order);
    return order;
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
    }
  }

  async getKhataAccount(customerId: string, shopId: string): Promise<KhataAccount | null> {
    return this.khataAccounts.get(`${customerId}:${shopId}`) || null;
  }

  async getKhataEntries(customerId: string, shopId: string): Promise<KhataEntry[]> {
    return this.khataEntries.get(`${customerId}:${shopId}`) || [];
  }

  async addKhataEntry(entryData: Omit<KhataEntry, 'id'>): Promise<KhataEntry> {
    const entry: KhataEntry = {
      ...entryData,
      id: `khata-${String(this.khataEntryCounter++).padStart(6, '0')}`,
    };

    const key = `${entry.customerId}:${entry.shopId}`;
    const entries = this.khataEntries.get(key) || [];
    entries.push(entry);
    this.khataEntries.set(key, entries);

    return entry;
  }

  async updateKhataBalance(customerId: string, shopId: string, amount: number): Promise<void> {
    const key = `${customerId}:${shopId}`;
    const account = this.khataAccounts.get(key);

    if (account) {
      account.balance += amount;
      account.lastUpdated = new Date().toISOString();
    } else {
      this.khataAccounts.set(key, {
        customerId,
        shopId,
        balance: amount,
        creditLimit: 5000,
        lastUpdated: new Date().toISOString(),
      });
    }
  }
}
