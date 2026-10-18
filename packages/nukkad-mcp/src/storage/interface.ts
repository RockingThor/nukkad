import type {
  Shop,
  Product,
  Customer,
  Cart,
  Order,
  KhataEntry,
  KhataAccount,
} from '../types.js';

export interface StorageLayer {
  // Shops
  getShops(): Promise<Shop[]>;
  getShop(id: string): Promise<Shop | null>;

  // Products
  getProducts(shopId: string): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;
  searchProducts(query: string, shopIds?: string[]): Promise<Product[]>;
  updateProductStock(productId: string, newStock: number): Promise<void>;

  // Customers
  getCustomer(id: string): Promise<Customer | null>;
  updateCustomer(customer: Customer): Promise<void>;

  // Cart
  getCart(customerId: string): Promise<Cart | null>;
  saveCart(cart: Cart): Promise<void>;
  clearCart(customerId: string): Promise<void>;

  // Orders
  getOrder(orderId: string): Promise<Order | null>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  getShopOrders(shopId: string): Promise<Order[]>;
  createOrder(order: Omit<Order, 'id'>): Promise<Order>;
  updateOrderStatus(orderId: string, status: Order['status']): Promise<void>;

  // Khata
  getKhataAccount(customerId: string, shopId: string): Promise<KhataAccount | null>;
  getKhataEntries(customerId: string, shopId: string): Promise<KhataEntry[]>;
  addKhataEntry(entry: Omit<KhataEntry, 'id'>): Promise<KhataEntry>;
  updateKhataBalance(customerId: string, shopId: string, amount: number): Promise<void>;
}
