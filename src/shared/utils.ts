import { nanoid } from 'nanoid'
import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types.js'

export function generateId(): string {
  return nanoid()
}

export function createRequest(method: string, params?: Record<string, any>): JSONRPCRequest {
  return {
    jsonrpc: '2.0',
    id: generateId(),
    method,
    ...(params && { params }),
  }
}

export function createResponse(
  id: string | number,
  result?: any,
  error?: { code: number; message: string; data?: any },
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    ...(result !== undefined && { result }),
    ...(error && { error }),
  }
}

export function createNotification(method: string, params?: Record<string, any>): JSONRPCNotification {
  return {
    jsonrpc: '2.0',
    method,
    ...(params && { params }),
  }
}

export function isRequest(message: any): message is JSONRPCRequest {
  return message && typeof message === 'object' && message.jsonrpc === '2.0' && 'method' in message && 'id' in message
}

export function isResponse(message: any): message is JSONRPCResponse {
  return (
    message && typeof message === 'object' && message.jsonrpc === '2.0' && 'id' in message && !('method' in message)
  )
}

export function isNotification(message: any): message is JSONRPCNotification {
  return (
    message && typeof message === 'object' && message.jsonrpc === '2.0' && 'method' in message && !('id' in message)
  )
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions && !!process.versions.node
}

export class McpError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any,
  ) {
    super(message)
    this.name = 'McpError'
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.data && { data: this.data }),
    }
  }
}
