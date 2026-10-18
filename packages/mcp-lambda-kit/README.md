# mcp-lambda-kit

Run stateless MCP 2025-11-25 Streamable HTTP servers on AWS Lambda Function URLs.

## Features

- ✅ **MCP 2025-11-25 Streamable HTTP** transport for AWS Lambda
- ✅ **RFC 9728 Protected Resource Metadata** helpers for OAuth 2.1 auth-code + PKCE (S256)
- ✅ **MCP Apps resource helpers** for UI card generation
- ✅ **Stateless** design optimized for serverless
- ✅ **TypeScript** with full type definitions
- ✅ **Tested** with Vitest

## Installation

```bash
npm install @nukkad/mcp-lambda-kit
# or
pnpm add @nukkad/mcp-lambda-kit
```

## Quick Start

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  handleStreamableHTTP,
  createProtectedResourceMetadata,
  handleProtectedResourceMetadata,
  type LambdaFunctionURLEvent,
  type LambdaFunctionURLResponse,
} from '@nukkad/mcp-lambda-kit';

// Create your MCP server
const server = new Server(
  {
    name: 'my-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Add your tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'hello',
      description: 'Say hello',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'hello') {
    return {
      content: [
        {
          type: 'text',
          text: 'Hello from Lambda!',
        },
      ],
    };
  }
  throw new Error('Unknown tool');
});

// Lambda handler
export async function handler(
  event: LambdaFunctionURLEvent
): Promise<LambdaFunctionURLResponse> {
  // Handle OAuth metadata endpoint
  const metadata = createProtectedResourceMetadata(
    'https://example.com',
    'https://example.com/oauth/authorize',
    'https://example.com/oauth/token'
  );
  
  const metadataResponse = handleProtectedResourceMetadata(event, metadata);
  if (metadataResponse) {
    return metadataResponse;
  }

  // Handle MCP requests
  return handleStreamableHTTP(event, {
    server,
    devBypassAuth: process.env.DEV_BYPASS_AUTH === 'true',
    validateToken: async (token: string) => {
      // Implement your token validation
      return token === 'valid-token';
    },
  });
}
```

## API Reference

### `handleStreamableHTTP(event, options)`

Handles incoming Lambda Function URL events and routes them to your MCP server.

**Options:**
- `server`: Your MCP Server instance
- `devBypassAuth`: Skip auth validation (dev only)
- `validateToken`: Async function to validate Bearer tokens

### `createProtectedResourceMetadata(issuer, authEndpoint, tokenEndpoint)`

Creates RFC 9728 compliant Protected Resource Metadata for OAuth 2.1.

### `handleProtectedResourceMetadata(event, metadata)`

Handles `/.well-known/oauth-authorization-server` requests.

### `createMCPAppsResource(uri, name, mimeType, description?)`

Helper for creating MCP Apps resource definitions.

## Deployment

### With AWS CDK

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';

const fn = new lambda.Function(this, 'MCPFunction', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('dist'),
});

const fnUrl = fn.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [lambda.HttpMethod.ALL],
  },
});

new cdk.CfnOutput(this, 'MCPServerURL', {
  value: fnUrl.url,
});
```

## Testing

```bash
pnpm test
```

## License

MIT

## Contributing

This library was created as part of the Nukkad project for the Amazon "Build, Ship, Shape" hackathon, Alexa+ track. Contributions are welcome!
