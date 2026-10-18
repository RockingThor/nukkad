import { NextRequest, NextResponse } from 'next/server';
import { createNukkadServer } from '@nukkad/mcp-server';
import { getSharedStorage } from '@/lib/shared-storage';

const storage = getSharedStorage();
const server = createNukkadServer(storage);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get the handler for the requested method
    const handler = (server as any)._requestHandlers?.get(body.method);
    
    if (!handler) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`,
          },
        },
        { status: 404 }
      );
    }

    // Call the handler
    const result = await handler.call(server, body);

    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result,
    });
  } catch (error: any) {
    console.error('MCP error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
