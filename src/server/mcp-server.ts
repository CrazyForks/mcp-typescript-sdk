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
  ServerOnlineNotification,
} from '../types.js'
import {
  InitializeRequestSchema,
  CallToolRequestSchema,
  ReadResourceRequestSchema,
  DisconnectedNotificationSchema,
  ErrorCode,
} from '../types.js'
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

  // Standard MQTT topics following official specification
  private topics: {
    control: string // $mcp-server/{server-id}/{server-name}
    capability: string // $mcp-server/capability/{server-id}/{server-name}
    presence: string // $mcp-server/presence/{server-id}/{server-name}
    rpcPattern: string // $mcp-rpc/{mcp-client-id}/{server-id}/{server-name}
  }

  private connectedClients = new Set<string>() // Track connected client IDs

  constructor(config: McpMqttServerConfig) {
    super()
    this.config = config

    // Validate server identifiers
    if (!config.identifiers?.serverId || !config.identifiers?.serverName) {
      throw new Error('Server identifiers (serverId and serverName) are required')
    }

    // Validate serverName format (hierarchical, no + or #)
    if (config.identifiers.serverName.includes('+') || config.identifiers.serverName.includes('#')) {
      throw new Error('Server name must not contain + or # characters')
    }

    // Set MQTT client ID to server-id
    config.mqtt.clientId = config.identifiers.serverId

    this.mqttAdapter = new UniversalMqttAdapter(config.mqtt)

    // Initialize standard MQTT topics
    const { serverId, serverName } = config.identifiers
    this.topics = {
      control: `$mcp-server/${serverId}/${serverName}`,
      capability: `$mcp-server/capability/${serverId}/${serverName}`,
      presence: `$mcp-server/presence/${serverId}/${serverName}`,
      rpcPattern: `$mcp-rpc/+/${serverId}/${serverName}`, // + is for client-id
    }

    // Set up will message for unexpected disconnection
    config.mqtt.will = {
      topic: this.topics.presence,
      payload: '', // Empty payload to clear presence
      qos: 1,
      retain: true,
    }
  }

  async start(): Promise<void> {
    try {
      // Set MQTT 5.0 user properties
      const userProperties = {
        'MCP-COMPONENT-TYPE': 'mcp-server',
        'MCP-META': JSON.stringify({
          version: this.config.serverInfo.version,
          implementation: 'mcp-typescript-sdk',
          serverName: this.config.identifiers.serverName,
          description: this.config.description,
          rbac: this.config.rbac,
        }),
      }

      // Add user properties to connection
      if (!this.config.mqtt.properties) {
        this.config.mqtt.properties = {}
      }
      this.config.mqtt.properties.userProperties = userProperties

      await this.mqttAdapter.connect()

      this.mqttAdapter.on('message', (topic, payload, packet) => {
        this.handleMessage(topic, payload.toString(), packet)
      })

      // Subscribe to server topics according to specification
      await this.mqttAdapter.subscribe(this.topics.control) // Control messages (initialize)
      await this.mqttAdapter.subscribe(this.topics.rpcPattern, { nl: true }) // RPC with No Local

      this.mqttAdapter.on('error', (error) => {
        this.emit('error', error)
      })

      // Publish server online presence with retain flag
      await this.publishServerOnline()

      this.emit('ready')
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    // Clear presence before disconnecting
    await this.mqttAdapter.publish(this.topics.presence, '', {
      retain: true,
      userProperties: {
        'MCP-COMPONENT-TYPE': 'mcp-server',
        'MCP-MQTT-CLIENT-ID': this.config.identifiers.serverId,
      },
    })
    await this.mqttAdapter.disconnect()
    this.emit('closed')
  }

  private async publishServerOnline(): Promise<void> {
    const onlineNotification: ServerOnlineNotification = {
      jsonrpc: '2.0',
      method: 'notifications/server/online',
      params: {
        server_name: this.config.identifiers.serverName,
        description: this.config.description || `MCP Server: ${this.config.serverInfo.name}`,
        meta: this.config.rbac ? { rbac: this.config.rbac } : undefined,
      },
    }

    await this.mqttAdapter.publish(this.topics.presence, JSON.stringify(onlineNotification), {
      retain: true,
      userProperties: {
        'MCP-COMPONENT-TYPE': 'mcp-server',
        'MCP-MQTT-CLIENT-ID': this.config.identifiers.serverId,
      },
    })
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
      name = nameOrSchema
      description = descriptionOrSchema as string
      inputSchema = inputSchemaOrHandler as Record<string, any>
      handler = handlerOrUndefined!
    } else {
      throw new Error('Zod schema API not implemented in this overload')
    }

    const toolDefinition: Tool = {
      name,
      description,
      inputSchema,
    }

    this.tools.set(name, { definition: toolDefinition, handler })

    // Notify about tools capability change if initialized
    if (this.isInitialized && this.config.capabilities?.tools?.listChanged) {
      this.notifyCapabilityChange('notifications/tools/list_changed')
    }
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

    // Notify about resources capability change if initialized
    if (this.isInitialized && this.config.capabilities?.resources?.listChanged) {
      this.notifyCapabilityChange('notifications/resources/list_changed')
    }
  }

  private async notifyCapabilityChange(method: string): Promise<void> {
    const notification = {
      jsonrpc: '2.0',
      method,
    }

    await this.mqttAdapter.publish(this.topics.capability, JSON.stringify(notification), {
      userProperties: {
        'MCP-COMPONENT-TYPE': 'mcp-server',
        'MCP-MQTT-CLIENT-ID': this.config.identifiers.serverId,
      },
    })
  }

  private async handleMessage(topic: string, message: string, packet: any): Promise<void> {
    try {
      // Extract client ID from topic if it's an RPC message
      let clientId: string | undefined

      if (topic.startsWith('$mcp-rpc/')) {
        const parts = topic.split('/')
        if (parts.length >= 2) {
          clientId = parts[1] // $mcp-rpc/{mcp-client-id}/...
        }
      } else if (topic.startsWith('$mcp-client/')) {
        const parts = topic.split('/')
        if (parts.length >= 3) {
          clientId = parts[2] // $mcp-client/{capability|presence}/{mcp-client-id}
        }
      }

      // For control messages, extract client ID from user properties
      if (topic === this.topics.control) {
        const userProperties = packet?.properties?.userProperties || {}
        clientId = userProperties['MCP-MQTT-CLIENT-ID']
      }

      // Handle different message types based on topic
      if (topic === this.topics.control) {
        await this.handleControlMessage(message, clientId)
      } else if (topic.startsWith('$mcp-rpc/')) {
        await this.handleRpcMessage(message, clientId!)
      } else if (topic.startsWith('$mcp-client/capability/')) {
        this.handleClientCapabilityChange(message, clientId!)
      } else if (topic.startsWith('$mcp-client/presence/')) {
        await this.handleClientPresence(message, clientId!)
      }
    } catch (error) {
      console.error('Failed to handle message:', error)
    }
  }

  private async handleControlMessage(message: string, clientId?: string): Promise<void> {
    const parsedMessage = JSON.parse(message)

    if (parsedMessage.method === 'initialize' && parsedMessage.id && clientId) {
      const request = parsedMessage as InitializeRequest
      const response = await this.handleInitialize(request, clientId)

      // Respond via RPC topic
      const rpcTopic = `$mcp-rpc/${clientId}/${this.config.identifiers.serverId}/${this.config.identifiers.serverName}`
      await this.mqttAdapter.publish(rpcTopic, JSON.stringify(response), {
        userProperties: {
          'MCP-COMPONENT-TYPE': 'mcp-server',
          'MCP-MQTT-CLIENT-ID': this.config.identifiers.serverId,
        },
      })

      // Subscribe to client-specific topics before responding according to specification
      await this.mqttAdapter.subscribe(`$mcp-client/capability/${clientId}`)
      await this.mqttAdapter.subscribe(`$mcp-client/presence/${clientId}`)

      this.connectedClients.add(clientId)
    }
  }

  private async handleRpcMessage(message: string, clientId: string): Promise<void> {
    const parsedMessage = JSON.parse(message)

    if (!parsedMessage.method || !parsedMessage.id) {
      return
    }

    const request = parsedMessage as JSONRPCRequest
    let response: JSONRPCResponse

    try {
      switch (request.method) {
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
        case 'ping':
          response = createResponse(request.id, { pong: true })
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

    // Send response back via RPC topic
    const rpcTopic = `$mcp-rpc/${clientId}/${this.config.identifiers.serverId}/${this.config.identifiers.serverName}`
    await this.mqttAdapter.publish(rpcTopic, JSON.stringify(response), {
      userProperties: {
        'MCP-COMPONENT-TYPE': 'mcp-server',
        'MCP-MQTT-CLIENT-ID': this.config.identifiers.serverId,
      },
    })
  }

  private handleClientCapabilityChange(message: string, clientId: string): void {
    // Handle client capability changes
    console.log(`Client ${clientId} capability changed:`, message)
  }

  private async handleClientPresence(message: string, clientId: string): Promise<void> {
    if (!message.trim()) {
      // If empty message, client disconnected unexpectedly
      this.connectedClients.delete(clientId)
      return
    }

    try {
      const parsedMessage = JSON.parse(message)
      // Validate disconnection message using Schema
      DisconnectedNotificationSchema.parse(parsedMessage)

      // Client disconnected gracefully
      this.connectedClients.delete(clientId)

      // Unsubscribe from client-specific topics
      await this.mqttAdapter.unsubscribe(`$mcp-client/capability/${clientId}`)
      await this.mqttAdapter.unsubscribe(`$mcp-client/presence/${clientId}`)
    } catch (error) {
      console.error('Failed to parse client disconnection message:', error)
      // Still remove the client on parse error
      this.connectedClients.delete(clientId)
    }
  }

  private async handleInitialize(request: InitializeRequest, clientId: string): Promise<JSONRPCResponse> {
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
      control: this.topics.control,
      capability: this.topics.capability,
      presence: this.topics.presence,
      rpc: this.topics.rpcPattern,
    }
  }

  getConnectedClients(): string[] {
    return Array.from(this.connectedClients)
  }
}

export function createMcpServer(config: McpMqttServerConfig): McpMqttServer {
  return new McpMqttServer(config)
}
