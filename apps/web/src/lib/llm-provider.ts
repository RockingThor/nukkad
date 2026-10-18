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
  step: string;
  awaitingSubstitutionConfirmation?: boolean;
}

export class MockLLMProvider implements LLMProvider {
  private state: ConversationState = { step: 'initial' };

  async chat(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()?.content.toLowerCase() || '';
    const conversationLength = messages.length;

    // Check if this is a confirmation response
    const isConfirmation = lastUserMessage.includes('yes') || lastUserMessage.includes('ok') || 
                          lastUserMessage.includes('sure') || lastUserMessage.includes('confirm');

    // Party order flow - handle in fewer steps
    if ((lastUserMessage.includes('party') || lastUserMessage.includes('friends') || lastUserMessage.includes('guests')) && conversationLength <= 3) {
      // Return all initial tool calls at once
      return {
        toolCalls: [
          { name: 'get_usual', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // After get_usual, build cart
    if (lastAssistantMessage.includes('found your usual') || lastAssistantMessage.includes('found') && conversationLength === 4) {
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
              scaleBy: 1.75
            } 
          },
        ],
        finishReason: 'tool_calls',
      };
    }

    // After cart built, place order directly (skip stock check for simplicity)
    if (lastAssistantMessage.includes('cart built') && conversationLength === 6) {
      return {
        toolCalls: [
          { name: 'place_order', arguments: { customerId: 'customer-1', paymentMethod: 'khata' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // After order placed, we're done
    if (lastAssistantMessage.includes('placed') && conversationLength === 8) {
      return {
        message: "Perfect! I've placed your orders across 2 shops. The total is on your khata. Everything will be ready for your party!",
        finishReason: 'stop',
      };
    }

    // Simple usual order (no party)
    if (lastUserMessage.includes('usual') && !lastUserMessage.includes('party') && !lastUserMessage.includes('friends')) {
      return {
        toolCalls: [
          { name: 'get_usual', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Hinglish product search
    if (lastUserMessage.includes('atta') || lastUserMessage.includes('aata') || 
        lastUserMessage.includes('doodh') || lastUserMessage.includes('dudh') || 
        (lastUserMessage.includes('milk') && !lastUserMessage.includes('balance'))) {
      const query = lastUserMessage.includes('atta') || lastUserMessage.includes('aata') ? 'atta' : 'milk';
      return {
        toolCalls: [
          { name: 'search_catalog', arguments: { query } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Track order
    if ((lastUserMessage.includes('order') && (lastUserMessage.includes('track') || lastUserMessage.includes('where'))) ||
        (lastUserMessage.includes('my order') || lastUserMessage.includes("where's"))) {
      return {
        toolCalls: [
          { name: 'track_order', arguments: { customerId: 'customer-1' } },
        ],
        finishReason: 'tool_calls',
      };
    }

    // Khata balance
    if ((lastUserMessage.includes('khata') || lastUserMessage.includes('balance') || lastUserMessage.includes('credit')) && 
        !lastUserMessage.includes('put it on')) {
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
