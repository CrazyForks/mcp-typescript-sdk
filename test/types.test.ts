import { describe, it, expect } from '@jest/globals'
import {
  JSONRPCRequestSchema,
  JSONRPCResponseSchema,
  JSONRPCNotificationSchema,
  ToolSchema,
  ResourceSchema,
  ErrorCode,
} from '../src/types.js'

describe('Types and Schemas', () => {
  describe('JSONRPCRequestSchema', () => {
    it('should validate a valid request', () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'tools/call',
        params: { name: 'test-tool' },
      }
      const result = JSONRPCRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should validate request with numeric id', () => {
      const request = {
        jsonrpc: '2.0',
        id: 123,
        method: 'test',
      }
      const result = JSONRPCRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should reject invalid jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        id: 'test',
        method: 'test',
      }
      const result = JSONRPCRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should reject request without method', () => {
      const request = {
        jsonrpc: '2.0',
        id: 'test',
      }
      const result = JSONRPCRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })
  })

  describe('JSONRPCResponseSchema', () => {
    it('should validate a successful response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 'test-123',
        result: { data: 'success' },
      }
      const result = JSONRPCResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate an error response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 'test-123',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Invalid parameters',
        },
      }
      const result = JSONRPCResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate error response with data', () => {
      const response = {
        jsonrpc: '2.0',
        id: 'test-123',
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal error',
          data: { details: 'More info' },
        },
      }
      const result = JSONRPCResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('JSONRPCNotificationSchema', () => {
    it('should validate a valid notification', () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/server/online',
        params: { server_name: 'test' },
      }
      const result = JSONRPCNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
    })

    it('should validate notification without params', () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/disconnected',
      }
      const result = JSONRPCNotificationSchema.safeParse(notification)
      expect(result.success).toBe(true)
    })
  })

  describe('ToolSchema', () => {
    it('should validate a valid tool', () => {
      const tool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
      }
      const result = ToolSchema.safeParse(tool)
      expect(result.success).toBe(true)
    })

    it('should validate tool without description', () => {
      const tool = {
        name: 'minimal-tool',
        inputSchema: {},
      }
      const result = ToolSchema.safeParse(tool)
      expect(result.success).toBe(true)
    })

    it('should reject tool without name', () => {
      const tool = {
        inputSchema: {},
      }
      const result = ToolSchema.safeParse(tool)
      expect(result.success).toBe(false)
    })
  })

  describe('ResourceSchema', () => {
    it('should validate a valid resource', () => {
      const resource = {
        uri: 'file:///path/to/resource',
        name: 'Test Resource',
        description: 'A test resource',
        mimeType: 'text/plain',
      }
      const result = ResourceSchema.safeParse(resource)
      expect(result.success).toBe(true)
    })

    it('should validate resource with minimal fields', () => {
      const resource = {
        uri: 'file:///path',
        name: 'Minimal',
      }
      const result = ResourceSchema.safeParse(resource)
      expect(result.success).toBe(true)
    })

    it('should reject resource without uri', () => {
      const resource = {
        name: 'No URI',
      }
      const result = ResourceSchema.safeParse(resource)
      expect(result.success).toBe(false)
    })
  })

  describe('ErrorCode', () => {
    it('should have correct JSON-RPC error codes', () => {
      expect(ErrorCode.PARSE_ERROR).toBe(-32700)
      expect(ErrorCode.INVALID_REQUEST).toBe(-32600)
      expect(ErrorCode.METHOD_NOT_FOUND).toBe(-32601)
      expect(ErrorCode.INVALID_PARAMS).toBe(-32602)
      expect(ErrorCode.INTERNAL_ERROR).toBe(-32603)
    })

    it('should have correct MCP-specific error codes', () => {
      expect(ErrorCode.INVALID_MESSAGE).toBe(-32000)
      expect(ErrorCode.TOOL_NOT_FOUND).toBe(-32001)
      expect(ErrorCode.RESOURCE_NOT_FOUND).toBe(-32002)
    })
  })
})
