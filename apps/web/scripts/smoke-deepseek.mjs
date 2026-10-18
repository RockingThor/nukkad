#!/usr/bin/env node
import 'dotenv/config';
import { DeepSeekProvider } from '../src/lib/llm-provider.js';
import { MCPClient } from '../src/lib/mcp-client.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY not set in environment');
  console.error('   Set it in .env or export DEEPSEEK_API_KEY=your_key_here');
  process.exit(1);
}

console.log('🧪 Nukkad DeepSeek Smoke Test');
console.log('================================\n');

async function runSmokeTest() {
  try {
    // Initialize MCP client (pointing to local API)
    const mcpClient = new MCPClient('http://localhost:3000/api/mcp');
    
    console.log('1. Initializing MCP client...');
    await mcpClient.initialize();
    console.log('   ✅ MCP client initialized\n');

    // Get available tools
    console.log('2. Fetching available tools...');
    const { tools } = await mcpClient.listTools();
    console.log(`   ✅ Found ${tools.length} tools\n`);

    const llmTools = tools.map((t: any) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    }));

    // Initialize DeepSeek provider
    console.log('3. Initializing DeepSeek provider...');
    const provider = new DeepSeekProvider(DEEPSEEK_API_KEY);
    console.log('   ✅ DeepSeek provider ready\n');

    // Test the headline flow
    console.log('4. Testing headline party order flow...');
    console.log('   User: "I\'m having 6 friends over Saturday for chai and snacks, get what I usually get plus enough for six, put it on my khata."\n');

    const systemMessage = {
      role: 'system' as const,
      content: 'You are Nukkad, a voice assistant for local corner stores. Help users order groceries. The user is "customer-1".',
    };

    const userMessage = {
      role: 'user' as const,
      content: "I'm having 6 friends over Saturday for chai and snacks. Get what I usually get, plus enough for six, and put it on my khata.",
    };

    const result = await provider.chatWithToolLoop(
      [systemMessage, userMessage],
      llmTools,
      async (name: string, args: any) => {
        console.log(`   🔧 Tool call: ${name}(${JSON.stringify(args)})`);
        const response = await mcpClient.callTool(name, args);
        console.log(`   ✅ Tool result received`);
        return response;
      }
    );

    console.log('\n5. Final response:');
    console.log(`   ${result.finalMessage}\n`);

    console.log('✅ Smoke test passed!');
    console.log('   DeepSeek successfully orchestrated the multi-step order flow.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Smoke test failed:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('API')) {
      console.error('\n   Check:');
      console.error('   - Is the web server running? (pnpm dev)');
      console.error('   - Is the DEEPSEEK_API_KEY valid?');
      console.error('   - Does your account have API access?');
    }
    
    process.exit(1);
  }
}

// Check if web server is running
async function checkWebServer() {
  try {
    const response = await fetch('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });
    
    if (!response.ok) {
      throw new Error('Web server responded with error');
    }
  } catch (error) {
    console.error('❌ Web server not reachable at http://localhost:3000');
    console.error('   Run `pnpm dev` in another terminal first');
    process.exit(1);
  }
}

checkWebServer().then(runSmokeTest);
