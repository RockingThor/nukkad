import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand, BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { StorageLayer } from './interface.js';
import type { Shop, Product, Customer, Cart, Order, KhataEntry, KhataAccount } from '../types.js';
import { seedShops, seedProducts, seedCustomers } from '../data/seed.js';
import { seedKhata, seedOrders } from './seed-state.js';

/**
 * Single table design. pk is the entity type, sk is the id.
 * KENTRY items use pk KENTRY#customer#shop so a ledger is one Query.
 */
export class DynamoStorage implements StorageLayer {
  private db: DynamoDBDocumentClient;
  private productCache?: Product[];
  constructor(private table: string, region = process.env.AWS_REGION ?? 'us-east-1') {
    this.db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
  }

  private async get<T>(pk: string, sk: string): Promise<T | null> {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk, sk } }));
    return (r.Item?.d as T) ?? null;
  }
  private async put(pk: string, sk: string, d: unknown) {
    await this.db.send(new PutCommand({ TableName: this.table, Item: { pk, sk, d } }));
  }
  private async query<T>(pk: string): Promise<T[]> {
    const out: T[] = [];
    let start: Record<string, any> | undefined;
    do {
      const r = await this.db.send(new QueryCommand({
        TableName: this.table, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': pk }, ExclusiveStartKey: start,
      }));
      for (const i of r.Items ?? []) out.push(i.d as T);
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  getShops() { return this.query<Shop>('SHOP'); }
  getShop(id: string) { return this.get<Shop>('SHOP', id); }
  private async allProducts() { return (this.productCache ??= await this.query<Product>('PRODUCT')); }
  async getProducts(shopId: string) { return (await this.allProducts()).filter((p) => p.shopId === shopId); }
  async getProduct(id: string) { return (await this.allProducts()).find((p) => p.id === id) ?? null; }
  async searchProducts(query: string, shopIds?: string[]) {
    const q = query.toLowerCase().trim();
    return (await this.allProducts()).filter((p) =>
      (!shopIds?.length || shopIds.includes(p.shopId)) &&
      (p.name.toLowerCase().includes(q) || p.aliases.some((a) => a.toLowerCase().includes(q)) || p.category.toLowerCase() === q));
  }
  async updateProductStock(id: string, stock: number) {
    const p = await this.getProduct(id);
    if (!p) return;
    p.stock = stock;
    await this.db.send(new UpdateCommand({
      TableName: this.table, Key: { pk: 'PRODUCT', sk: id }, UpdateExpression: 'SET d.stock = :s', ExpressionAttributeValues: { ':s': stock },
    }));
  }
  getCustomer(id: string) { return this.get<Customer>('CUSTOMER', id); }
  updateCustomer(c: Customer) { return this.put('CUSTOMER', c.id, c); }
  getCart(id: string) { return this.get<Cart>('CART', id); }
  saveCart(c: Cart) { return this.put('CART', c.customerId, c); }
  async clearCart(id: string) { await this.db.send(new DeleteCommand({ TableName: this.table, Key: { pk: 'CART', sk: id } })); }
  getOrder(id: string) { return this.get<Order>('ORDER', id); }
  private sortDesc(o: Order[]) { return o.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)); }
  async getCustomerOrders(id: string) { return this.sortDesc((await this.query<Order>('ORDER')).filter((o) => o.customerId === id)); }
  async getShopOrders(id: string) { return this.sortDesc((await this.query<Order>('ORDER')).filter((o) => o.shopId === id)); }
  private async next(name: string) {
    const r = await this.db.send(new UpdateCommand({
      TableName: this.table, Key: { pk: 'META', sk: name }, UpdateExpression: 'ADD n :one', ExpressionAttributeValues: { ':one': 1 }, ReturnValues: 'UPDATED_NEW',
    }));
    return Number(r.Attributes?.n ?? 1);
  }
  async createOrder(data: Omit<Order, 'id'>) {
    const order: Order = { ...data, id: `NK-${String(1000 + (await this.next('order'))).padStart(4, '0')}` };
    await this.put('ORDER', order.id, order);
    return order;
  }
  async updateOrderStatus(id: string, status: Order['status']) {
    const o = await this.getOrder(id);
    if (!o) return;
    await this.put('ORDER', id, { ...o, status, updatedAt: new Date().toISOString() });
  }
  getKhataAccount(c: string, s: string) { return this.get<KhataAccount>('KHATA', `${c}#${s}`); }
  async getKhataEntries(c: string, s: string) { return (await this.query<KhataEntry>(`KENTRY#${c}#${s}`)).sort((a, b) => a.date.localeCompare(b.date)); }
  async addKhataEntry(e: Omit<KhataEntry, 'id'>) {
    const entry: KhataEntry = { ...e, id: `khata-${await this.next('khata')}` };
    await this.put(`KENTRY#${e.customerId}#${e.shopId}`, `${entry.date}#${entry.id}`, entry);
    return entry;
  }
  async updateKhataBalance(c: string, s: string, amount: number) {
    const a = (await this.getKhataAccount(c, s)) ?? { customerId: c, shopId: s, balance: 0, creditLimit: 3000, lastUpdated: '' };
    await this.put('KHATA', `${c}#${s}`, { ...a, balance: a.balance + amount, lastUpdated: new Date().toISOString() });
  }

  /** Wipe demo state and write the seed again. */
  async reset() {
    const wipe = async (pk: string) => {
      const r = await this.db.send(new QueryCommand({ TableName: this.table, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': pk }, ProjectionExpression: 'pk, sk' }));
      await this.batch((r.Items ?? []).map((i) => ({ DeleteRequest: { Key: { pk: i.pk, sk: i.sk } } })));
    };
    const k = seedKhata();
    for (const pk of ['ORDER', 'CART', 'META', 'KHATA', ...k.accounts.map((a) => `KENTRY#${a.customerId}#${a.shopId}`)]) await wipe(pk);
    const items: any[] = [
      ...seedShops.map((d) => ({ pk: 'SHOP', sk: d.id, d })),
      ...seedProducts.map((d) => ({ pk: 'PRODUCT', sk: d.id, d })),
      ...seedCustomers.map((d) => ({ pk: 'CUSTOMER', sk: d.id, d })),
      ...k.accounts.map((d) => ({ pk: 'KHATA', sk: `${d.customerId}#${d.shopId}`, d })),
      ...k.entries.map((d) => ({ pk: `KENTRY#${d.customerId}#${d.shopId}`, sk: `${d.date}#${d.id}`, d })),
      ...seedOrders().map((d) => ({ pk: 'ORDER', sk: d.id, d })),
      { pk: 'META', sk: 'khata', n: 100 },
    ];
    await this.batch(items.map((Item) => ({ PutRequest: { Item } })));
    this.productCache = undefined;
  }
  private async batch(reqs: any[]) {
    for (let i = 0; i < reqs.length; i += 25) {
      let chunk: any = { [this.table]: reqs.slice(i, i + 25) };
      while (chunk && Object.keys(chunk).length && chunk[this.table]?.length) {
        const r = await this.db.send(new BatchWriteCommand({ RequestItems: chunk }));
        chunk = r.UnprocessedItems;
      }
    }
  }
}
