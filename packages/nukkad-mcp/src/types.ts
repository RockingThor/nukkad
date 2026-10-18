export interface Shop {
  id: string;
  name: string;
  type: 'kirana' | 'bakery' | 'dairy' | 'vegetable';
  address: string;
  phone: string;
  openHours: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  aliases: string[];
  category: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string;
  /** Preferred substitutes, in order, when this item runs short. */
  substitutes?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  usualOrder?: UsualOrderItem[];
  preferences?: Record<string, any>;
}

export interface UsualOrderItem {
  productId: string;
  shopId: string;
  quantity: number;
}

export interface CartItem {
  productId: string;
  shopId: string;
  quantity: number;
  price: number;
  productName: string;
}

export interface Cart {
  customerId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'accepted' | 'ready' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  customerId: string;
  customerName?: string;
  deliverBy?: string;
  shopId: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  paymentMethod: 'cash' | 'khata' | 'upi';
  createdAt: string;
  updatedAt: string;
  deliveryAddress: string;
}

export interface KhataEntry {
  id: string;
  customerId: string;
  shopId: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  orderId?: string;
  date: string;
}

export interface KhataAccount {
  customerId: string;
  shopId: string;
  balance: number;
  creditLimit: number;
  lastUpdated: string;
}
