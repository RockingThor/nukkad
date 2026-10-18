import type { KhataAccount, KhataEntry, Order } from '../types.js';

/** Opening khata state for the demo customer, shared by every storage backend. */
export function seedKhata(): { accounts: KhataAccount[]; entries: KhataEntry[] } {
  const now = new Date().toISOString();
  const c = 'customer-1';
  return {
    accounts: [
      { customerId: c, shopId: 'shop-kirana-1', balance: -450, creditLimit: 10000, lastUpdated: now },
      { customerId: c, shopId: 'shop-bakery-1', balance: -120, creditLimit: 5000, lastUpdated: now },
      { customerId: c, shopId: 'shop-dairy-1', balance: -240, creditLimit: 6000, lastUpdated: now },
    ],
    entries: [
      { id: 'khata-001', customerId: c, shopId: 'shop-kirana-1', amount: 500, type: 'debit', description: 'Monthly groceries', date: '2026-10-01T10:00:00Z' },
      { id: 'khata-002', customerId: c, shopId: 'shop-kirana-1', amount: 50, type: 'credit', description: 'Paid in cash', date: '2026-10-10T15:30:00Z' },
      { id: 'khata-003', customerId: c, shopId: 'shop-bakery-1', amount: 120, type: 'debit', description: 'Bread and rusk', date: '2026-10-05T09:00:00Z' },
      { id: 'khata-004', customerId: c, shopId: 'shop-dairy-1', amount: 240, type: 'debit', description: 'Milk for the week', date: '2026-10-12T07:15:00Z' },
    ],
  };
}

/** A few earlier orders from today so the shop console opens on a real day. */
export function seedOrders(): Order[] {
  const t = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();
  const mk = (id: string, shopId: string, h: number, status: Order['status'], pay: Order['paymentMethod'], items: [string, string, number, number][]): Order => ({
    id, customerId: 'customer-2', customerName: 'Priya', shopId, status, paymentMethod: pay, createdAt: t(h), updatedAt: t(h - 0.5),
    deliveryAddress: '789 Villa Gardens, House 15',
    items: items.map(([productId, productName, quantity, price]) => ({ productId, productName, quantity, price, shopId })),
    total: items.reduce((a, [, , q, p]) => a + q * p, 0),
  });
  return [
    mk('NK-0997', 'shop-kirana-1', 5, 'delivered', 'upi', [['prod-kirana-002', 'Rice', 2, 65], ['prod-kirana-007', 'Lentils', 1, 95]]),
    mk('NK-0998', 'shop-dairy-1', 4, 'delivered', 'cash', [['prod-dairy-001', 'Milk', 2, 60], ['prod-dairy-004', 'Paneer', 1, 90]]),
    mk('NK-0999', 'shop-bakery-1', 3, 'delivered', 'khata', [['prod-bakery-003', 'Pav Buns', 2, 20], ['prod-bakery-005', 'Cake Rusk', 1, 55]]),
    mk('NK-1000', 'shop-kirana-1', 2, 'ready', 'cash', [['prod-kirana-026', 'Poha', 1, 48], ['prod-kirana-024', 'Peanuts', 1, 90]]),
  ];
}
