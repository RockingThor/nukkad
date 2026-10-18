import { NextRequest, NextResponse } from 'next/server';
import { getSharedStorage } from '@/lib/shared-storage';

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
