import { NextRequest, NextResponse } from 'next/server';
import { MemoryStorage } from '@nukkad/mcp-server/dist/storage/memory.js';

// Share the same storage instance across all API routes
let sharedStorage: MemoryStorage | null = null;

export function getSharedStorage() {
  if (!sharedStorage) {
    sharedStorage = new MemoryStorage();
  }
  return sharedStorage;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shopId } = await params;
  
  try {
    const storage = getSharedStorage();
    const orders = await storage.getShopOrders(shopId);
    
    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shopId } = await params;
  
  try {
    const body = await request.json();
    const { orderId, status } = body;
    
    const storage = getSharedStorage();
    await storage.updateOrderStatus(orderId, status);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
