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
        content: `You are Nukkad, a voice assistant for local corner stores. Help users order groceries, track orders, and manage their khata (store credit). The user is "customer-1". Be conversational and helpful. When handling party orders, scale the usual order appropriately.`,
      };

      // Call LLM
      const response = await llmProvider.current.chat(
        [systemMessage, ...newMessages],
        llmTools
      );

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute tool calls
        const toolResults = await Promise.all(
          response.toolCalls.map(async (tc) => {
            const result = await mcpClient.current!.callTool(tc.name, tc.arguments);
            return { tool: tc.name, result };
          })
        );

        // For demo, show the last result
        const lastResult = toolResults[toolResults.length - 1];
        const resultText = JSON.stringify(lastResult.result, null, 2);
        
        // Generate response based on tool results
        let responseText = '';
        if (lastResult.tool === 'place_order') {
          responseText = `Great! I've placed ${lastResult.result.orders?.length || 0} order(s) for you. Total: ₹${lastResult.result.totalAmount || 0}.`;
          setCurrentCard({ type: 'cart', data: lastResult.result });
        } else if (lastResult.tool === 'khata_balance') {
          responseText = `Your khata balance: You owe ₹${lastResult.result.totalDue || 0} across ${lastResult.result.accounts?.length || 0} shop(s).`;
          setCurrentCard({ type: 'khata', data: lastResult.result });
        } else if (lastResult.tool === 'track_order') {
          responseText = `You have ${lastResult.result.count || 0} recent order(s).`;
          setCurrentCard({ type: 'tracker', data: lastResult.result });
        } else {
          responseText = `I found ${lastResult.result.count || lastResult.result.items?.length || 0} item(s) for you.`;
        }

        setConversation([
          ...newMessages,
          { role: 'assistant', content: responseText },
        ]);
        speak(responseText);
      } else if (response.message) {
        setConversation([
          ...newMessages,
          { role: 'assistant', content: response.message },
        ]);
        speak(response.message);
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
    <div style={{ display: 'flex', height: '100vh', background: '#000' }}>
      {/* Main conversation area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Simulated Alexa+</h1>
          <p style={{ color: 'var(--color-light-gray)' }}>Voice-enabled corner store assistant</p>
        </header>

        {/* Conversation */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          marginBottom: '2rem',
          border: '1px solid var(--color-gray)',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}>
          {conversation.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                background: msg.role === 'user' ? '#1a1a1a' : '#0a0a0a',
                borderRadius: '0.5rem',
                borderLeft: `4px solid ${msg.role === 'user' ? 'var(--color-green)' : 'var(--color-red)'}`,
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-gray)', marginBottom: '0.5rem' }}>
                {msg.role === 'user' ? 'You' : 'Nukkad'}
              </div>
              <div>{msg.content}</div>
            </div>
          ))}
          {isProcessing && (
            <div style={{ textAlign: 'center', color: 'var(--color-gray)' }}>
              Processing...
            </div>
          )}
        </div>

        {/* Voice input */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={startListening}
            disabled={isListening || isProcessing}
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: isListening ? 'var(--color-red)' : 'var(--color-white)',
              color: isListening ? 'var(--color-white)' : 'var(--color-black)',
              border: 'none',
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isListening || isProcessing ? 'not-allowed' : 'pointer',
              opacity: isListening || isProcessing ? 0.7 : 1,
            }}
          >
            🎤
          </button>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcript && !isProcessing) {
                  handleUserInput(transcript);
                }
              }}
              placeholder="Or type your message here..."
              style={{
                width: '100%',
                padding: '1rem',
                background: '#1a1a1a',
                border: '1px solid var(--color-gray)',
                borderRadius: '0.5rem',
                color: 'var(--color-white)',
                fontSize: '1rem',
              }}
            />
          </div>
        </div>

        {/* MCP Apps Card */}
        {currentCard && (
          <div style={{ 
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#1a1a1a',
            border: '2px solid var(--color-green)',
            borderRadius: '0.5rem',
          }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              {currentCard.type === 'cart' && '🛒 Order Summary'}
              {currentCard.type === 'khata' && '📒 Khata Ledger'}
              {currentCard.type === 'tracker' && '📦 Order Tracker'}
            </h3>
            <pre style={{ 
              fontSize: '0.875rem', 
              color: 'var(--color-light-gray)',
              overflowX: 'auto',
            }}>
              {JSON.stringify(currentCard.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Protocol panel */}
      <div style={{ 
        width: '400px', 
        borderLeft: '1px solid var(--color-gray)',
        padding: '2rem',
        overflowY: 'auto',
        background: '#0a0a0a',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>MCP Protocol</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-gray)', marginBottom: '2rem' }}>
          JSON-RPC messages over Streamable HTTP
        </p>
        <div>
          {protocolMessages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: msg.type === 'request' ? '#1a0a0a' : '#0a1a0a',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
              }}
            >
              <div style={{ 
                color: msg.type === 'request' ? 'var(--color-red)' : 'var(--color-green)',
                marginBottom: '0.25rem',
              }}>
                {msg.type === 'request' ? '→' : '←'} {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(msg.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
