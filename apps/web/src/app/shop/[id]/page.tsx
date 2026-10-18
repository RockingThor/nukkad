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
      // Get shop info via MCP
      const shopResponse = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'find_shops',
            arguments: {},
          },
        }),
      });
      const shopData = await shopResponse.json();
      
      if (shopData.result?.content?.[0]?.text) {
        const shopsResult = JSON.parse(shopData.result.content[0].text);
        const shop = shopsResult.shops.find((s: any) => s.id === shopId);
        if (shop) {
          setShopName(shop.name);
        }
      }

      // Get shop orders directly
      const ordersResponse = await fetch(`/api/shop/${shopId}/orders`);
      const ordersData = await ordersResponse.json();
      
      if (ordersData.orders) {
        setOrders(ordersData.orders);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading shop data:', error);
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await fetch(`/api/shop/${shopId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      await loadShopData();
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
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1200px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '-0.02em' }}>
          {shopName || 'Shop Console'}
        </h1>
        <p style={{ color: '#999', fontSize: '0.875rem' }}>Manage incoming orders and khata</p>
      </header>

      <div style={{ 
        background: '#0a0a0a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '2rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: '600' }}>Incoming Orders</h2>
        
        {orders.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            padding: '3rem 1rem',
            border: '2px dashed #333',
            borderRadius: '8px',
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No new orders yet</p>
            <p style={{ fontSize: '0.875rem' }}>Orders will appear here in real-time</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{
                  background: '#000',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {order.id}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '0.5rem 1rem',
                    background: order.status === 'pending' ? '#1a0505' : 
                               order.status === 'accepted' ? '#1a1505' :
                               order.status === 'ready' ? '#051a05' : '#0a0a0a',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: order.status === 'pending' ? '#dc2626' :
                           order.status === 'accepted' ? '#999' :
                           order.status === 'ready' ? '#16a34a' : '#666',
                    border: '1px solid',
                    borderColor: order.status === 'pending' ? '#331010' :
                                order.status === 'accepted' ? '#333310' :
                                order.status === 'ready' ? '#103310' : '#1a1a1a',
                  }}>
                    {order.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    {order.items.length} item(s) • ₹{order.total.toFixed(2)} • {order.paymentMethod}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    {order.deliveryAddress}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'accepted')}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                    >
                      Accept Order
                    </button>
                  )}
                  {order.status === 'accepted' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Mark Ready
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
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
        background: '#0a0a0a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '2rem',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: '600' }}>Khata Ledger</h2>
        <p style={{ color: '#666' }}>Khata management coming soon...</p>
      </div>
    </div>
  );
}
