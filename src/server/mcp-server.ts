import { EventEmitter } from 'events'
import { z } from 'zod'
import type {
  McpMqttServerConfig,
  Tool,
  Resource,
  JSONRPCRequest,
  JSONRPCResponse,
  InitializeRequest,
  CallToolRequest,
  ReadResourceRequest,
} from '../types.js'
import { InitializeRequestSchema, CallToolRequestSchema, ReadResourceRequestSchema, ErrorCode } from '../types.js'
import { UniversalMqttAdapter } from '../shared/mqtt-adapter.js'
import { createResponse, McpError } from '../shared/utils.js'

export interface ToolHandler {
  (params: Record<string, any>): Promise<{
    content: Array<{
      type: string
      text?: string
      data?: string
      mimeType?: string
    }>
    isError?: boolean
  }>
}

export interface ResourceHandler {
  (): Promise<{
    contents: Array<{
      uri: string
      mimeType?: string
      text?: string
      blob?: string
    }>
  }>
}

export class McpMqttServer extends EventEmitter {
  private mqttAdapter: UniversalMqttAdapter
  private config: McpMqttServerConfig
  private tools: Map<string, { definition: Tool; handler: ToolHandler }> = new Map()
  private resources: Map<string, { definition: Resource; handler: ResourceHandler }> = new Map()
  private isInitialized = false
  private requestTopic: string
  private responseTopic: string

  constructor(config: McpMqttServerConfig) {
    super()
    this.config = config
    this.mqttAdapter = new UniversalMqttAdapter(config.mqtt)

    // Generate topic names based on server name
    const serverName = config.serverInfo.name.toLowerCase().replace(/\s+/g, '-')
    this.requestTopic = `mcp/servers/${serverName}/requests`
    this.responseTopic = `mcp/servers/${serverName}/responses`
  }

  async start(): Promise<void> {
    try {
      await this.mqttAdapter.connect()
      await this.mqttAdapter.subscribe(this.requestTopic)

      this.mqttAdapter.on('message', (topic, payload) => {
        if (topic === this.requestTopic) {
          this.handleMessage(payload.toString())
        }
      })

      this.mqttAdapter.on('error', (error) => {
        this.emit('error', error)
      })

      this.emit('ready')
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    await this.mqttAdapter.disconnect()
    this.emit('closed')
  }

  tool<T extends z.ZodSchema>(
    name: string,
    schema: T,
    handler: (params: z.infer<T>) => Promise<{
      content: Array<{
        type: string
        text?: string
        data?: string
        mimeType?: string
      }>
      isError?: boolean
    }>,
  ): void
  tool(name: string, description: string, inputSchema: Record<string, any>, handler: ToolHandler): void
  tool(
    nameOrSchema: string | z.ZodSchema,
    descriptionOrSchema?: string | z.ZodSchema,
    inputSchemaOrHandler?: Record<string, any> | ToolHandler,
    handlerOrUndefined?: ToolHandler,
  ): void {
    let name: string
    let description: string | undefined
    let inputSchema: Record<string, any>
    let handler: ToolHandler

    if (typeof nameOrSchema === 'string') {
      // Traditional API: tool(name, description, inputSchema, handler)
      name = nameOrSchema
      description = descriptionOrSchema as string
      inputSchema = inputSchemaOrHandler as Record<string, any>
      handler = handlerOrUndefined!
    } else {
      // Zod API: tool(name, schema, handler) - not implemented in this signature
      throw new Error('Zod schema API not implemented in this overload')
    }

    const toolDefinition: Tool = {
      name,
      description,
      inputSchema,
    }

    this.tools.set(name, { definition: toolDefinition, handler })
  }

  resource(
    uri: string,
    name: string,
    handler: ResourceHandler,
    options?: {
      description?: string
      mimeType?: string
    },
  ): void {
    const resourceDefinition: Resource = {
      uri,
      name,
      description: options?.description,
      mimeType: options?.mimeType,
    }

    this.resources.set(uri, { definition: resourceDefinition, handler })
  }

  private async handleMessage(message: string): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message)

      if (!parsedMessage.method || !parsedMessage.id) {
        return
      }

      const request = parsedMessage as JSONRPCRequest
      let response: JSONRPCResponse

      try {
        switch (request.method) {
          case 'initialize':
            response = await this.handleInitialize(request as InitializeRequest)
            break
          case 'tools/list':
            response = this.handleToolsList(request)
            break
          case 'tools/call':
            response = await this.handleToolCall(request as CallToolRequest)
            break
          case 'resources/list':
            response = this.handleResourcesList(request)
            break
          case 'resources/read':
            response = await this.handleResourceRead(request as ReadResourceRequest)
            break
          default:
            response = createResponse(request.id, undefined, {
              code: ErrorCode.METHOD_NOT_FOUND,
              message: `Method not found: ${request.method}`,
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof McpError
            ? error
            : new McpError(ErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Internal error')

        response = createResponse(request.id, undefined, mcpError.toJSON())
      }

      await this.mqttAdapter.publish(this.responseTopic, JSON.stringify(response))
    } catch (error) {
      console.error('Failed to handle message:', error)
    }
  }

  private async handleInitialize(request: InitializeRequest): Promise<JSONRPCResponse> {
    try {
      InitializeRequestSchema.parse(request)
      this.isInitialized = true

      return createResponse(request.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          logging: {},
          prompts: {
            listChanged: this.config.capabilities?.prompts?.listChanged ?? false,
          },
          resources: {
            subscribe: this.config.capabilities?.resources?.subscribe ?? false,
            listChanged: this.config.capabilities?.resources?.listChanged ?? false,
          },
          tools: {
            listChanged: this.config.capabilities?.tools?.listChanged ?? false,
          },
          ...this.config.capabilities,
        },
        serverInfo: this.config.serverInfo,
      })
    } catch (error) {
      throw new McpError(ErrorCode.INVALID_PARAMS, 'Invalid initialize request')
    }
  }

  private handleToolsList(request: JSONRPCRequest): JSONRPCResponse {
    const toolsList = Array.from(this.tools.values()).map(({ definition }) => definition)
    return createResponse(request.id, { tools: toolsList })
  }

  private async handleToolCall(request: CallToolRequest): Promise<JSONRPCResponse> {
    try {
      CallToolRequestSchema.parse(request)

      const toolName = request.params.name
      const toolEntry = this.tools.get(toolName)

      if (!toolEntry) {
        throw new McpError(ErrorCode.TOOL_NOT_FOUND, `Tool not found: ${toolName}`)
      }

      const result = await toolEntry.handler(request.params.arguments ?? {})
      return createResponse(request.id, result)
    } catch (error) {
      if (error instanceof McpError) {
        throw error
      }
      throw new McpError(ErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Tool execution failed')
    }
  }

  private handleResourcesList(request: JSONRPCRequest): JSONRPCResponse {
    const resourcesList = Array.from(this.resources.values()).map(({ definition }) => definition)
    return createResponse(request.id, { resources: resourcesList })
  }

  private async handleResourceRead(request: ReadResourceRequest): Promise<JSONRPCResponse> {
    try {
      ReadResourceRequestSchema.parse(request)

      const uri = request.params.uri
      const resourceEntry = this.resources.get(uri)

      if (!resourceEntry) {
        throw new McpError(ErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`)
      }

      const result = await resourceEntry.handler()
      return createResponse(request.id, result)
    } catch (error) {
      if (error instanceof McpError) {
        throw error
      }
      throw new McpError(ErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Resource read failed')
    }
  }

  getTopics() {
    return {
      request: this.requestTopic,
      response: this.responseTopic,
    }
  }
}

export function createMcpServer(config: McpMqttServerConfig): McpMqttServer {
  return new McpMqttServer(config)
}
