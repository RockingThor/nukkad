'use client';

import { useState, useEffect, useRef } from 'react';
import { MCPClient, type MCPTool, type MCPMessage, type MCPResponse } from '@/lib/mcp-client';
import { MockLLMProvider, DeepSeekProvider, type LLMProvider, type LLMMessage } from '@/lib/llm-provider';

interface ProtocolMessage {
  timestamp: string;
  type: 'request' | 'response';
  data: MCPMessage | MCPResponse;
}

export default function AlexaPage() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<LLMMessage[]>([]);
  const [protocolMessages, setProtocolMessages] = useState<ProtocolMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentCard, setCurrentCard] = useState<any>(null);
  
  const mcpClient = useRef<MCPClient | null>(null);
  const llmProvider = useRef<LLMProvider | null>(null);
  const recognition = useRef<any>(null);

  useEffect(() => {
    // Initialize MCP client
    mcpClient.current = new MCPClient('/api/mcp');
    mcpClient.current.onMessage = (msg) => {
      setProtocolMessages(prev => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          type: 'method' in msg ? 'request' : 'response',
          data: msg,
        },
      ]);
    };

    // Initialize LLM provider (mock by default)
    llmProvider.current = new MockLLMProvider();

    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      recognition.current = new (window as any).webkitSpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-IN';

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTranscript(transcript);
        handleUserInput(transcript);
      };

      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }

    // Initialize MCP
    mcpClient.current.initialize().catch(console.error);
  }, []);

  const startListening = () => {
    if (recognition.current) {
      setTranscript('');
      recognition.current.start();
      setIsListening(true);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleUserInput = async (input: string) => {
    if (!mcpClient.current || !llmProvider.current || isProcessing) return;

    setIsProcessing(true);
    const newMessages: LLMMessage[] = [
      ...conversation,
      { role: 'user', content: input },
    ];
    setConversation(newMessages);

    try {
      // Get available tools from MCP
      const { tools } = await mcpClient.current.listTools();
      
      const llmTools = tools.map((t: MCPTool) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }));

      // System message for context
      const systemMessage: LLMMessage = {
        role: 'system',
        content: `You are Nukkad, a voice assistant for local corner stores. Help users order groceries, track orders, and manage their khata (store credit). The user is "customer-1". Be conversational and helpful.`,
      };

      let conversationHistory = [...newMessages];
      let iterations = 0;
      const maxIterations = 15; // Increased from 10 for complex flows
      let finalResponse = '';
      let finalCard: any = null;

      // Multi-turn tool loop
      while (iterations < maxIterations) {
        iterations++;

        // Call LLM
        const response = await llmProvider.current.chat(
          [systemMessage, ...conversationHistory],
          llmTools
        );

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Execute tool calls sequentially
          for (const tc of response.toolCalls) {
            const result = await mcpClient.current!.callTool(tc.name, tc.arguments);
            
            // Generate natural language response based on tool
            let toolResponse = '';
            
            if (tc.name === 'get_usual') {
              const items = result.content[0]?.text ? JSON.parse(result.content[0].text).items : [];
              toolResponse = `I found your usual order with ${items.length} items.`;
            } else if (tc.name === 'build_cart') {
              const cart = result.content[0]?.text ? JSON.parse(result.content[0].text).cart : null;
              toolResponse = `Cart built with ${cart?.itemCount || 0} items. Total: ₹${cart?.total || 0}.`;
            } else if (tc.name === 'check_stock_and_substitute') {
              const stockResult = result.content[0]?.text ? JSON.parse(result.content[0].text) : null;
              if (stockResult?.outOfStock?.length > 0) {
                const outItem = stockResult.outOfStock[0];
                if (outItem.suggestedSubstitute) {
                  toolResponse = `${outItem.productName} is out of stock. Would you like to substitute with ${outItem.suggestedSubstitute.productName}? (Say yes to confirm)`;
                  // Add to conversation and wait for confirmation
                  conversationHistory.push({ role: 'assistant', content: toolResponse });
                  setConversation([...conversationHistory]);
                  speak(toolResponse);
                  setIsProcessing(false);
                  return; // Exit and wait for user confirmation
                }
              } else {
                toolResponse = `All items are in stock!`;
              }
            } else if (tc.name === 'khata_balance') {
              const khataResult = result.content[0]?.text ? JSON.parse(result.content[0].text) : null;
              toolResponse = `Your khata balance checked. Available credit confirmed.`;
              finalCard = { type: 'khata', data: khataResult };
            } else if (tc.name === 'place_order') {
              const orderResult = result.content[0]?.text ? JSON.parse(result.content[0].text) : null;
              toolResponse = `Great! I've placed ${orderResult?.orders?.length || 0} order(s) for you. Total: ₹${orderResult?.totalAmount || 0}.`;
              finalResponse = toolResponse;
              finalCard = { type: 'cart', data: orderResult };
              break; // Orders placed, we're done
            } else if (tc.name === 'track_order') {
              const trackResult = result.content[0]?.text ? JSON.parse(result.content[0].text) : null;
              toolResponse = `You have ${trackResult?.count || 0} recent order(s).`;
              finalResponse = toolResponse;
              finalCard = { type: 'tracker', data: trackResult };
              break;
            } else if (tc.name === 'search_catalog') {
              const searchResult = result.content[0]?.text ? JSON.parse(result.content[0].text) : null;
              toolResponse = `I found ${searchResult?.count || 0} product(s) matching "${searchResult?.query || ''}".`;
            } else {
              toolResponse = `Tool ${tc.name} executed successfully.`;
            }

            // Add tool result to conversation
            if (toolResponse && tc.name !== 'place_order' && tc.name !== 'track_order') {
              conversationHistory.push({ role: 'assistant', content: toolResponse });
            }
          }

          // If we got a final response, break
          if (finalResponse) {
            break;
          }
        } else if (response.message) {
          // LLM returned a text response
          finalResponse = response.message;
          break;
        } else {
          break;
        }
      }

      // Update conversation with final response
      if (finalResponse) {
        const updatedConversation = [
          ...newMessages,
          { role: 'assistant', content: finalResponse },
        ];
        setConversation(updatedConversation);
        speak(finalResponse);
        
        if (finalCard) {
          setCurrentCard(finalCard);
        }
      } else if (iterations >= maxIterations) {
        const errorMsg = 'Sorry, the conversation took too many steps. Please try again.';
        setConversation([
          ...newMessages,
          { role: 'assistant', content: errorMsg },
        ]);
        speak(errorMsg);
      }
    } catch (error: any) {
      console.error('Error processing input:', error);
      const errorMsg = `Sorry, I encountered an error: ${error.message}`;
      setConversation([
        ...newMessages,
        { role: 'assistant', content: errorMsg },
      ]);
      speak(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {/* Main conversation area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2rem', minWidth: 0 }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '-0.02em' }}>
            Simulated Alexa+
          </h1>
          <p style={{ color: '#999', fontSize: '0.875rem' }}>Voice-enabled corner store assistant</p>
        </header>

        {/* Conversation */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          marginBottom: '1.5rem',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1rem',
          minHeight: 0,
        }}>
          {conversation.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              padding: '3rem 1rem',
            }}>
              <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
                Try: "I'm having 6 friends over for chai and snacks..."
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Or: "ek kilo atta aur do packet doodh"
              </p>
            </div>
          )}
          {conversation.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                background: msg.role === 'user' ? '#0a0a0a' : '#1a1a1a',
                borderRadius: '8px',
                borderLeft: `3px solid ${msg.role === 'user' ? '#16a34a' : '#dc2626'}`,
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                {msg.role === 'user' ? 'You' : 'Nukkad'}
              </div>
              <div style={{ lineHeight: '1.6' }}>{msg.content}</div>
            </div>
          ))}
          {isProcessing && (
            <div style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>
              <div style={{ display: 'inline-block' }}>Processing...</div>
            </div>
          )}
        </div>

        {/* Voice input */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={startListening}
            disabled={isListening || isProcessing}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isListening ? '#dc2626' : '#fff',
              color: isListening ? '#fff' : '#000',
              border: 'none',
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isListening || isProcessing ? 'not-allowed' : 'pointer',
              opacity: isListening || isProcessing ? 0.7 : 1,
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            title={isListening ? 'Listening...' : 'Click to speak'}
          >
            🎤
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcript && !isProcessing) {
                  handleUserInput(transcript);
                  setTranscript('');
                }
              }}
              placeholder="Or type your message here..."
              disabled={isProcessing}
              style={{
                width: '100%',
                padding: '1rem',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* MCP Apps Card */}
        {currentCard && (
          <div style={{ 
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: '#0a0a0a',
            border: '2px solid #16a34a',
            borderRadius: '8px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {currentCard.type === 'cart' && <>🛒 Order Summary</>}
              {currentCard.type === 'khata' && <>📒 Khata Ledger</>}
              {currentCard.type === 'tracker' && <>📦 Order Tracker</>}
            </h3>
            <pre style={{ 
              fontSize: '0.75rem', 
              color: '#999',
              overflowX: 'auto',
              lineHeight: '1.5',
              fontFamily: 'ui-monospace, monospace',
            }}>
              {JSON.stringify(currentCard.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Protocol panel */}
      <div style={{ 
        width: '400px', 
        borderLeft: '1px solid #333',
        padding: '2rem',
        overflowY: 'auto',
        background: '#0a0a0a',
        display: 'none',
      }}
      className="protocol-panel">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: '600' }}>MCP Protocol</h2>
        <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1.5rem' }}>
          JSON-RPC 2.0 over Streamable HTTP
        </p>
        <div>
          {protocolMessages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: msg.type === 'request' ? '#1a0505' : '#051a0a',
                borderRadius: '4px',
                fontSize: '0.625rem',
                fontFamily: 'ui-monospace, monospace',
                border: `1px solid ${msg.type === 'request' ? '#331010' : '#103310'}`,
              }}
            >
              <div style={{ 
                color: msg.type === 'request' ? '#dc2626' : '#16a34a',
                marginBottom: '0.5rem',
                fontSize: '0.625rem',
                fontWeight: '600',
              }}>
                {msg.type === 'request' ? '→ REQUEST' : '← RESPONSE'} {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
                {JSON.stringify(msg.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media (min-width: 768px) {
          .protocol-panel {
            display: block !important;
          }
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #0a0a0a;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
      `}</style>
    </div>
  );
}
