export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: any;
}

export interface LLMToolCall {
  name: string;
  arguments: any;
}

export interface LLMResponse {
  message?: string;
  toolCalls?: LLMToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface LLMProvider {
  chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse>;
}

export class MockLLMProvider implements LLMProvider {
  private static scenarios: Map<string, (messages: LLMMessage[], tools: LLMTool[]) => LLMResponse> = new Map([
    ['usual', () => ({
      toolCalls: [
        { name: 'get_usual', arguments: { customerId: 'customer-1' } },
      ],
      finishReason: 'tool_calls',
    })],
    ['party', () => ({
      toolCalls: [
        { name: 'get_usual', arguments: { customerId: 'customer-1' } },
        { name: 'build_cart', arguments: { customerId: 'customer-1', items: [], scaleBy: 2 } },
        { name: 'check_stock_and_substitute', arguments: { customerId: 'customer-1', autoSubstitute: false } },
        { name: 'place_order', arguments: { customerId: 'customer-1', paymentMethod: 'khata' } },
      ],
      finishReason: 'tool_calls',
    })],
  ]);

  async chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';

    // Detect scenario
    if (lastUserMessage.includes('usual') && !lastUserMessage.includes('party')) {
      return MockLLMProvider.scenarios.get('usual')!(...arguments);
    }

    if (lastUserMessage.includes('party') || lastUserMessage.includes('friends') || lastUserMessage.includes('guests')) {
      return MockLLMProvider.scenarios.get('party')!(...arguments);
    }

    if (lastUserMessage.includes('atta') || lastUserMessage.includes('doodh') || lastUserMessage.includes('milk')) {
      return {
        toolCalls: [
          { name: 'search_catalog', arguments: { query: lastUserMessage.includes('atta') ? 'atta' : 'milk' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    if (lastUserMessage.includes('order') && lastUserMessage.includes('track')) {
      return {
        toolCalls: [
          { name: 'track_order', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    if (lastUserMessage.includes('khata') || lastUserMessage.includes('balance')) {
      return {
        toolCalls: [
          { name: 'khata_balance', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Default response
    return {
      message: 'I can help you order from your local corner stores. Try saying "get my usual order" or "I need milk and bread".',
      finishReason: 'stop',
    };
  }
}

export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      }),
    });

    const data = await response.json();
    const choice = data.choices[0];

    if (choice.message.tool_calls) {
      return {
        toolCalls: choice.message.tool_calls.map((tc: any) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        finishReason: 'tool_calls',
      };
    }

    return {
      message: choice.message.content,
      finishReason: choice.finish_reason,
    };
  }
}
