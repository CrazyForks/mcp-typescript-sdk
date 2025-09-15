import { describe, it, expect, jest } from '@jest/globals'

// Mock nanoid before importing utils
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id-123'),
}))

import { createRequest, createResponse, createNotification, generateId, McpError } from '../src/shared/utils.js'
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
  })
})
