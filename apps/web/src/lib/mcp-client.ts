export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class MCPClient {
  private baseUrl: string;
  private messageId: number = 1;
  public onMessage?: (message: MCPMessage | MCPResponse) => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async call(method: string, params?: any): Promise<any> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params,
    };

    this.onMessage?.(message);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result: MCPResponse = await response.json();
    this.onMessage?.(result);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  async initialize() {
    return this.call('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: {
        name: 'nukkad-web',
        version: '1.0.0',
      },
    });
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return this.call('tools/list');
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.call('tools/call', {
      name,
      arguments: args,
    });
  }

  async listResources() {
    return this.call('resources/list');
  }

  async readResource(uri: string) {
    return this.call('resources/read', { uri });
  }
}
