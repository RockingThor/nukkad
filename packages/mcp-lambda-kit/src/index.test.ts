import { describe, it, expect } from 'vitest';
import {
  createProtectedResourceMetadata,
  createMCPAppsResource,
  handleProtectedResourceMetadata,
} from './index.js';
import type { LambdaFunctionURLEvent } from './index.js';

describe('mcp-lambda-kit', () => {
  describe('createProtectedResourceMetadata', () => {
    it('creates RFC 9728 compliant metadata', () => {
      const metadata = createProtectedResourceMetadata(
        'https://example.com',
        'https://example.com/oauth/authorize',
        'https://example.com/oauth/token'
      );

      expect(metadata.issuer).toBe('https://example.com');
      expect(metadata.authorization_endpoint).toBe('https://example.com/oauth/authorize');
      expect(metadata.token_endpoint).toBe('https://example.com/oauth/token');
      expect(metadata.response_types_supported).toContain('code');
      expect(metadata.grant_types_supported).toContain('authorization_code');
      expect(metadata.code_challenge_methods_supported).toContain('S256');
    });
  });

  describe('handleProtectedResourceMetadata', () => {
    it('returns metadata for well-known endpoint', () => {
      const event: LambdaFunctionURLEvent = {
        version: '2.0',
        rawPath: '/.well-known/oauth-authorization-server',
        rawQueryString: '',
        headers: {},
        requestContext: {
          requestId: 'test',
          http: {
            method: 'GET',
            path: '/.well-known/oauth-authorization-server',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test',
          },
        },
        isBase64Encoded: false,
      };

      const metadata = createProtectedResourceMetadata(
        'https://example.com',
        'https://example.com/oauth/authorize',
        'https://example.com/oauth/token'
      );

      const response = handleProtectedResourceMetadata(event, metadata);

      expect(response).not.toBeNull();
      expect(response?.statusCode).toBe(200);
      expect(response?.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(response?.body || '{}');
      expect(body.issuer).toBe('https://example.com');
      expect(body.code_challenge_methods_supported).toContain('S256');
    });

    it('returns null for non-matching paths', () => {
      const event: LambdaFunctionURLEvent = {
        version: '2.0',
        rawPath: '/other-path',
        rawQueryString: '',
        headers: {},
        requestContext: {
          requestId: 'test',
          http: {
            method: 'GET',
            path: '/other-path',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'test',
          },
        },
        isBase64Encoded: false,
      };

      const metadata = createProtectedResourceMetadata(
        'https://example.com',
        'https://example.com/oauth/authorize',
        'https://example.com/oauth/token'
      );

      const response = handleProtectedResourceMetadata(event, metadata);
      expect(response).toBeNull();
    });
  });

  describe('createMCPAppsResource', () => {
    it('creates an MCP Apps resource', () => {
      const resource = createMCPAppsResource(
        'ui://cart',
        'Shopping Cart',
        'application/json',
        'View and edit cart items'
      );

      expect(resource.uri).toBe('ui://cart');
      expect(resource.name).toBe('Shopping Cart');
      expect(resource.mimeType).toBe('application/json');
      expect(resource.description).toBe('View and edit cart items');
    });

    it('creates resource without description', () => {
      const resource = createMCPAppsResource(
        'ui://tracker',
        'Order Tracker',
        'application/json'
      );

      expect(resource.uri).toBe('ui://tracker');
      expect(resource.description).toBeUndefined();
    });
  });
});
