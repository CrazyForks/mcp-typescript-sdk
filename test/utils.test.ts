import { describe, it, expect, jest } from '@jest/globals'

// Mock nanoid before importing utils
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id-123'),
}))

import {
  createRequest,
  createResponse,
  createNotification,
  generateId,
  McpError,
  isRequest,
  isResponse,
  isNotification,
  isNode,
  isBrowser,
} from '../src/shared/utils.js'
import { ErrorCode } from '../src/types.js'

describe('Utils', () => {
  describe('generateId', () => {
    it('should generate IDs', () => {
      const id = generateId()
      expect(id).toBe('mock-id-123')
      expect(typeof id).toBe('string')
    })
  })

  describe('createRequest', () => {
    it('should create valid JSON-RPC request with params', () => {
      const request = createRequest('test_method', { key: 'value' })

      expect(request.jsonrpc).toBe('2.0')
      expect(request.method).toBe('test_method')
      expect(request.params).toEqual({ key: 'value' })
      expect(request.id).toBe('mock-id-123')
    })

    it('should create valid JSON-RPC request without params', () => {
      const request = createRequest('test_method')

      expect(request.jsonrpc).toBe('2.0')
      expect(request.method).toBe('test_method')
      expect(request.params).toBeUndefined()
      expect(request.id).toBe('mock-id-123')
    })
  })

  describe('createResponse', () => {
    it('should create successful response', () => {
      const response = createResponse('test-id', { data: 'success' })

      expect(response.jsonrpc).toBe('2.0')
      expect(response.id).toBe('test-id')
      expect(response.result).toEqual({ data: 'success' })
      expect(response.error).toBeUndefined()
    })

    it('should create error response', () => {
      const error = {
        code: ErrorCode.INVALID_PARAMS,
        message: 'Invalid parameters',
      }
      const response = createResponse('test-id', undefined, error)

      expect(response.jsonrpc).toBe('2.0')
      expect(response.id).toBe('test-id')
      expect(response.result).toBeUndefined()
      expect(response.error).toEqual(error)
    })
  })

  describe('createNotification', () => {
    it('should create notification with params', () => {
      const notification = createNotification('test_event', { data: 'value' })

      expect(notification.jsonrpc).toBe('2.0')
      expect(notification.method).toBe('test_event')
      expect(notification.params).toEqual({ data: 'value' })
      expect('id' in notification).toBeFalsy()
    })

    it('should create notification without params', () => {
      const notification = createNotification('test_event')

      expect(notification.jsonrpc).toBe('2.0')
      expect(notification.method).toBe('test_event')
      expect(notification.params).toBeUndefined()
    })
  })

  describe('McpError', () => {
    it('should create error with code and message', () => {
      const error = new McpError(ErrorCode.INVALID_PARAMS, 'Invalid parameters')

      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCode.INVALID_PARAMS)
      expect(error.message).toBe('Invalid parameters')
    })

    it('should be throwable', () => {
      expect(() => {
        throw new McpError(ErrorCode.INTERNAL_ERROR, 'Something went wrong')
      }).toThrow(McpError)
    })

    it('should serialize to JSON correctly', () => {
      const error = new McpError(ErrorCode.INVALID_PARAMS, 'Invalid parameters', { field: 'name' })
      const json = error.toJSON()

      expect(json).toEqual({
        code: ErrorCode.INVALID_PARAMS,
        message: 'Invalid parameters',
        data: { field: 'name' },
      })
    })

    it('should serialize to JSON without data when not provided', () => {
      const error = new McpError(ErrorCode.INTERNAL_ERROR, 'Internal error')
      const json = error.toJSON()

      expect(json).toEqual({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal error',
      })
      expect('data' in json).toBe(false)
    })
  })

  describe('isRequest', () => {
    it('should return true for valid request', () => {
      const request = { jsonrpc: '2.0', id: '123', method: 'test' }
      expect(isRequest(request)).toBe(true)
    })

    it('should return false for response', () => {
      const response = { jsonrpc: '2.0', id: '123', result: {} }
      expect(isRequest(response)).toBe(false)
    })

    it('should return false for notification', () => {
      const notification = { jsonrpc: '2.0', method: 'test' }
      expect(isRequest(notification)).toBe(false)
    })

    it('should return false for invalid objects', () => {
      expect(isRequest(null)).toBe(false)
      expect(isRequest(undefined)).toBe(false)
      expect(isRequest({})).toBe(false)
      expect(isRequest({ jsonrpc: '1.0', id: '1', method: 'test' })).toBe(false)
    })
  })

  describe('isResponse', () => {
    it('should return true for valid response with result', () => {
      const response = { jsonrpc: '2.0', id: '123', result: { data: 'test' } }
      expect(isResponse(response)).toBe(true)
    })

    it('should return true for valid response with error', () => {
      const response = { jsonrpc: '2.0', id: '123', error: { code: -32600, message: 'Invalid' } }
      expect(isResponse(response)).toBe(true)
    })

    it('should return false for request', () => {
      const request = { jsonrpc: '2.0', id: '123', method: 'test' }
      expect(isResponse(request)).toBe(false)
    })

    it('should return false for notification', () => {
      const notification = { jsonrpc: '2.0', method: 'test' }
      expect(isResponse(notification)).toBe(false)
    })

    it('should return false for invalid objects', () => {
      expect(isResponse(null)).toBe(false)
      expect(isResponse(undefined)).toBe(false)
      expect(isResponse({})).toBe(false)
    })
  })

  describe('isNotification', () => {
    it('should return true for valid notification', () => {
      const notification = { jsonrpc: '2.0', method: 'test' }
      expect(isNotification(notification)).toBe(true)
    })

    it('should return true for notification with params', () => {
      const notification = { jsonrpc: '2.0', method: 'test', params: { key: 'value' } }
      expect(isNotification(notification)).toBe(true)
    })

    it('should return false for request', () => {
      const request = { jsonrpc: '2.0', id: '123', method: 'test' }
      expect(isNotification(request)).toBe(false)
    })

    it('should return false for response', () => {
      const response = { jsonrpc: '2.0', id: '123', result: {} }
      expect(isNotification(response)).toBe(false)
    })

    it('should return false for invalid objects', () => {
      expect(isNotification(null)).toBe(false)
      expect(isNotification(undefined)).toBe(false)
      expect(isNotification({})).toBe(false)
    })
  })

  describe('Environment detection', () => {
    it('should detect Node.js environment', () => {
      expect(isNode()).toBe(true)
    })

    it('should not detect browser environment in Node.js', () => {
      expect(isBrowser()).toBe(false)
    })
  })
})
