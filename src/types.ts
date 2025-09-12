import { z } from 'zod'

// Base MCP message types following the official specification
export const JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.any()).optional(),
})

export const JSONRPCResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.any().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.any().optional(),
    })
    .optional(),
})

export const JSONRPCNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.any()).optional(),
})

export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>
export type JSONRPCNotification = z.infer<typeof JSONRPCNotificationSchema>

// MCP-specific message types
export const InitializeRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.literal('initialize'),
  params: z.object({
    protocolVersion: z.string(),
    capabilities: z.object({
      roots: z
        .object({
          listChanged: z.boolean().optional(),
        })
        .optional(),
      sampling: z.record(z.any()).optional(),
    }),
    clientInfo: z.object({
      name: z.string(),
      version: z.string(),
    }),
  }),
})

export const InitializeResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    protocolVersion: z.string(),
    capabilities: z.object({
      logging: z.record(z.any()).optional(),
      prompts: z
        .object({
          listChanged: z.boolean().optional(),
        })
        .optional(),
      resources: z
        .object({
          subscribe: z.boolean().optional(),
          listChanged: z.boolean().optional(),
        })
        .optional(),
      tools: z
        .object({
          listChanged: z.boolean().optional(),
        })
        .optional(),
    }),
    serverInfo: z.object({
      name: z.string(),
      version: z.string(),
    }),
  }),
})

// Tool-related schemas
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.any()),
})

export const CallToolRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.literal('tools/call'),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.any()).optional(),
  }),
})

export const CallToolResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    content: z.array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
        data: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    ),
    isError: z.boolean().optional(),
  }),
})

// Resource-related schemas
export const ResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
})

export const ReadResourceRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.literal('resources/read'),
  params: z.object({
    uri: z.string(),
  }),
})

// MQTT-specific types
export interface MqttConnectionOptions {
  host: string
  port?: number
  clientId?: string
  username?: string
  password?: string
  clean?: boolean
  keepalive?: number
  connectTimeout?: number
  reconnectPeriod?: number
  will?: {
    topic: string
    payload: string | Buffer
    qos?: 0 | 1 | 2
    retain?: boolean
  }
}

export interface McpMqttServerConfig {
  mqtt: MqttConnectionOptions
  serverInfo: {
    name: string
    version: string
  }
  capabilities?: {
    logging?: Record<string, any>
    prompts?: {
      listChanged?: boolean
    }
    resources?: {
      subscribe?: boolean
      listChanged?: boolean
    }
    tools?: {
      listChanged?: boolean
    }
  }
}

export interface McpMqttClientConfig {
  mqtt: MqttConnectionOptions
  clientInfo: {
    name: string
    version: string
  }
  capabilities?: {
    roots?: {
      listChanged?: boolean
    }
    sampling?: Record<string, any>
  }
}

export type Tool = z.infer<typeof ToolSchema>
export type Resource = z.infer<typeof ResourceSchema>
export type InitializeRequest = z.infer<typeof InitializeRequestSchema>
export type InitializeResponse = z.infer<typeof InitializeResponseSchema>
export type CallToolRequest = z.infer<typeof CallToolRequestSchema>
export type CallToolResponse = z.infer<typeof CallToolResponseSchema>
export type ReadResourceRequest = z.infer<typeof ReadResourceRequestSchema>

// Error codes following JSON-RPC 2.0 specification
export enum ErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  // MCP-specific error codes
  INVALID_MESSAGE = -32000,
  TOOL_NOT_FOUND = -32001,
  RESOURCE_NOT_FOUND = -32002,
}
