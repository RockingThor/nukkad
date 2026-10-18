'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';

interface Order {
  id: string;
  customerId: string;
  total: number;
  status: string;
  items: any[];
  createdAt: string;
}

export default function ShopConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shopId } = use(params);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopName, setShopName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadShopData();
    const interval = setInterval(loadShopData, 3000);
    return () => clearInterval(interval);
  }, [shopId]);

  const loadShopData = async () => {
    try {
      // Get shop info
      const shopResponse = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'find_shops',
            arguments: {},
          },
        }),
      });
      const shopData = await shopResponse.json();
      const shop = shopData.result.content[0]?.text
        ? JSON.parse(shopData.result.content[0].text).shops.find((s: any) => s.id === shopId)
        : null;
      
      if (shop) {
        setShopName(shop.name);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading shop data:', error);
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'update_order_status',
            arguments: { orderId, status },
          },
        }),
      });
      loadShopData();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-gray)' }}>Loading shop console...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{shopName || 'Shop Console'}</h1>
        <p style={{ color: 'var(--color-light-gray)' }}>Manage incoming orders and khata</p>
      </header>

      <div style={{ 
        background: '#1a1a1a',
        border: '1px solid var(--color-gray)',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Incoming Orders</h2>
        
        {orders.length === 0 ? (
          <p style={{ color: 'var(--color-gray)' }}>No orders yet. Orders will appear here in real-time.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid var(--color-gray)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <strong>{order.id}</strong>
                    <span style={{ marginLeft: '1rem', color: 'var(--color-gray)' }}>
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    background: order.status === 'pending' ? 'var(--color-red)' : 'var(--color-green)',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                  }}>
                    {order.status}
                  </div>
                </div>
                <div style={{ marginBottom: '0.5rem', color: 'var(--color-light-gray)' }}>
                  {order.items.length} item(s) • ₹{order.total}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'accepted')}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--color-green)',
                        color: 'var(--color-white)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      Accept
                    </button>
                  )}
                  {order.status === 'accepted' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--color-green)',
                        color: 'var(--color-white)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      Mark Ready
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--color-green)',
                        color: 'var(--color-white)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ 
        background: '#1a1a1a',
        border: '1px solid var(--color-gray)',
        borderRadius: '0.5rem',
        padding: '1.5rem',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Khata Ledger</h2>
        <p style={{ color: 'var(--color-gray)' }}>Khata management coming soon...</p>
      </div>
    </div>
  );
}
