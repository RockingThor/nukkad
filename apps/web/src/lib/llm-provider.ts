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

interface ConversationState {
  step: 'initial' | 'awaiting_substitution' | 'placing_order' | 'done';
  usualItems?: any[];
  cartBuilt?: boolean;
  stockChecked?: boolean;
  substituteConfirmed?: boolean;
}

export class MockLLMProvider implements LLMProvider {
  private state: ConversationState = { step: 'initial' };

  async chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()?.content.toLowerCase() || '';

    // Check if this is a confirmation response
    const isConfirmation = lastUserMessage.includes('yes') || lastUserMessage.includes('ok') || 
                          lastUserMessage.includes('sure') || lastUserMessage.includes('confirm');

    // Party order flow (multi-step)
    if ((lastUserMessage.includes('party') || lastUserMessage.includes('friends') || lastUserMessage.includes('guests')) && this.state.step === 'initial') {
      // Step 1: Get usual order
      this.state.step = 'initial';
      return {
        toolCalls: [
          { name: 'get_usual', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // After getting usual, build cart with scale
    if (this.state.step === 'initial' && lastAssistantMessage.includes('found') && !this.state.cartBuilt) {
      const guestCount = this.extractGuestCount(lastUserMessage);
      const scaleBy = (guestCount + 1) / 4; // Assume usual is for 4 people, scale to guests + host
      
      // Extract items from the tool result in conversation
      // In a real scenario, we'd parse the previous tool result, but for mock we'll use a simple pattern
      this.state.cartBuilt = true;
      return {
        toolCalls: [
          { 
            name: 'build_cart', 
            arguments: { 
              customerId: 'customer-1', 
              items: [
                { productId: 'prod-kirana-001', shopId: 'shop-kirana-1', quantity: 2 },
                { productId: 'prod-dairy-001', shopId: 'shop-dairy-1', quantity: 2 },
                { productId: 'prod-kirana-004', shopId: 'shop-kirana-1', quantity: 1 },
                { productId: 'prod-bakery-001', shopId: 'shop-bakery-1', quantity: 2 },
                { productId: 'prod-dairy-002', shopId: 'shop-dairy-1', quantity: 1 },
                { productId: 'prod-kirana-015', shopId: 'shop-kirana-1', quantity: 3 },
              ], 
              scaleBy: Math.max(1.5, scaleBy)
            } 
          },
        ],
        finishReason: 'tool_calls',
      };
    }

    // After building cart, check stock
    if (this.state.cartBuilt && !this.state.stockChecked) {
      this.state.stockChecked = true;
      this.state.step = 'awaiting_substitution';
      return {
        toolCalls: [
          { name: 'check_stock_and_substitute', arguments: { customerId: 'customer-1', autoSubstitute: false } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Handle substitution confirmation
    if (this.state.step === 'awaiting_substitution' && isConfirmation) {
      this.state.substituteConfirmed = true;
      this.state.step = 'placing_order';
      
      // Check khata balance first
      return {
        toolCalls: [
          { name: 'khata_balance', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // After checking khata, place orders
    if (this.state.step === 'placing_order' && lastAssistantMessage.includes('balance')) {
      this.state.step = 'done';
      return {
        toolCalls: [
          { name: 'place_order', arguments: { customerId: 'customer-1', paymentMethod: 'khata' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Simple usual order (no party)
    if (lastUserMessage.includes('usual') && !lastUserMessage.includes('party') && !lastUserMessage.includes('friends')) {
      this.state = { step: 'initial' };
      return {
        toolCalls: [
          { name: 'get_usual', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Hinglish product search
    if (lastUserMessage.includes('atta') || lastUserMessage.includes('aata') || 
        lastUserMessage.includes('doodh') || lastUserMessage.includes('dudh') || lastUserMessage.includes('milk')) {
      const query = lastUserMessage.includes('atta') || lastUserMessage.includes('aata') ? 'atta' : 'doodh';
      return {
        toolCalls: [
          { name: 'search_catalog', arguments: { query } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Track order
    if ((lastUserMessage.includes('order') && (lastUserMessage.includes('track') || lastUserMessage.includes('where'))) ||
        lastUserMessage.includes('my order')) {
      return {
        toolCalls: [
          { name: 'track_order', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Khata balance
    if (lastUserMessage.includes('khata') || lastUserMessage.includes('balance') || lastUserMessage.includes('credit')) {
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

  private extractGuestCount(message: string): number {
    const match = message.match(/(\d+)\s*(friends|guests|people)/i);
    return match ? parseInt(match[1]) : 6;
  }

  reset() {
    this.state = { step: 'initial' };
  }
}

export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;
  private maxIterations: number = 10;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
    try {
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(`DeepSeek API error: ${errorData.error?.message || response.statusText}`);
      }

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
        message: choice.message.content || 'No response from DeepSeek',
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      };
    } catch (error: any) {
      console.error('DeepSeek provider error:', error);
      throw new Error(`DeepSeek: ${error.message}`);
    }
  }

  async chatWithToolLoop(
    initialMessages: LLMMessage[],
    tools: LLMTool[],
    executeToolFn: (name: string, args: any) => Promise<any>
  ): Promise<{ finalMessage: string; conversationHistory: LLMMessage[] }> {
    let conversationHistory = [...initialMessages];
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      const response = await this.chat(conversationHistory, tools);

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute tool calls
        for (const toolCall of response.toolCalls) {
          try {
            const result = await executeToolFn(toolCall.name, toolCall.arguments);
            
            // Add tool result to conversation
            conversationHistory.push({
              role: 'assistant',
              content: `[Tool ${toolCall.name} called with ${JSON.stringify(toolCall.arguments)}. Result: ${JSON.stringify(result)}]`,
            });
          } catch (error: any) {
            conversationHistory.push({
              role: 'assistant',
              content: `[Tool ${toolCall.name} failed: ${error.message}]`,
            });
          }
        }
      } else if (response.message) {
        // Got final text response
        return {
          finalMessage: response.message,
          conversationHistory: [...conversationHistory, { role: 'assistant', content: response.message }],
        };
      } else {
        throw new Error('Unexpected response from LLM');
      }
    }

    throw new Error(`Conversation exceeded maximum iterations (${this.maxIterations})`);
  }
}
