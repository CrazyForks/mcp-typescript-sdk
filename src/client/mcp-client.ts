import { EventEmitter } from 'events'
import type {
  McpMqttClientConfig,
  MqttConnectionOptions,
  Tool,
  Resource,
  JSONRPCRequest,
  JSONRPCResponse,
  ServerOnlineNotification,
  DisconnectedNotification,
} from '../types.js'
import {
  ServerOnlineNotificationSchema,
  DisconnectedNotificationSchema,
  CallToolRequestSchema,
  ReadResourceRequestSchema,
} from '../types.js'
import { UniversalMqttAdapter, parseUndefined } from '../shared/mqtt-adapter.js'
import { createRequest, generateId, McpError } from '../shared/utils.js'

export interface ServerInfo {
  serverId: string
  serverName: string
  description: string
  name: string
  version: string
  capabilities: {
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
  rbac?: {
    roles: Array<{
      name: string
      description: string
      allowed_methods: string[]
      allowed_tools: 'all' | string[]
      allowed_resources: 'all' | string[]
    }>
  }
}

export class McpMqttClient extends EventEmitter {
  private mqttAdapter: UniversalMqttAdapter
  private config: McpMqttClientConfig
  private mcpClientId: string
  private serverNameFilter: string // Topic filter for server discovery

  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }
  >()

  private discoveredServers = new Map<string, ServerInfo>() // serverId -> ServerInfo
  private connectedServers = new Map<string, ServerInfo>() // serverId -> ServerInfo

  constructor(config: McpMqttClientConfig) {
    super()
    this.config = config

    // Generate unique client ID for each initialization
    this.mcpClientId = config.clientId || `mcp-client-${generateId()}`

    // Default server name filter (can be overridden by broker)
    this.serverNameFilter = '#' // Subscribe to all servers by default

    // Build MQTT connection options from flat config, filtering undefined values
    const mqttOptions: MqttConnectionOptions = {
      host: config.host,

      clientId: this.mcpClientId,
      ...parseUndefined({
        username: config.username,
        password: config.password,
        clean: config.clean,
        keepalive: config.keepalive,
        connectTimeout: config.connectTimeout,
        reconnectPeriod: config.reconnectPeriod,
      }),
      properties: {
        ...config.properties,
        userProperties: {
          'MCP-COMPONENT-TYPE': 'mcp-client',
          'MCP-META': JSON.stringify({
            version: config.version,
            implementation: 'mcp-typescript-sdk',
            capabilities: config.capabilities,
          }),
        },
      },
    }

    this.mqttAdapter = new UniversalMqttAdapter(mqttOptions)

    // Set up will message for unexpected disconnection
    const disconnectedNotification: DisconnectedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/disconnected',
    }

    mqttOptions.will = config.will || {
      topic: `$mcp-client/presence/${this.mcpClientId}`,
      payload: JSON.stringify(disconnectedNotification),
      qos: 1,
      retain: false,
    }
  }

  async connect(): Promise<void> {
    try {
      // User properties are already set via mqttOptions in constructor

      await this.mqttAdapter.connect()

      // Handle broker-suggested server name filters from CONNACK user properties
      this.handleBrokerSuggestions()

      this.mqttAdapter.on('message', (topic, payload, packet) => {
        this.handleMessage(topic, payload.toString(), packet)
      })

      this.mqttAdapter.on('error', (error) => {
        this.emit('error', error)
      })

      // Subscribe to server discovery and capability topics
      await this.mqttAdapter.subscribe(`$mcp-server/presence/+/${this.serverNameFilter}`)
      await this.mqttAdapter.subscribe(`$mcp-server/capability/+/${this.serverNameFilter}`)
      await this.mqttAdapter.subscribe(`$mcp-rpc/${this.mcpClientId}/+/${this.serverNameFilter}`, { nl: true })

      // Start server discovery
      await this.discoverServers()

      this.emit('connected')
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    // Send disconnected notification to all connected servers
    for (const [serverId, server] of this.connectedServers) {
      const disconnectedNotification: DisconnectedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/disconnected',
      }

      const rpcTopic = `$mcp-rpc/${this.mcpClientId}/${serverId}/${server.serverName}`
      await this.mqttAdapter.publish(rpcTopic, JSON.stringify(disconnectedNotification), {
        userProperties: {
          'MCP-COMPONENT-TYPE': 'mcp-client',
          'MCP-MQTT-CLIENT-ID': this.mcpClientId,
        },
      })
    }

    // Send client presence disconnection
    const disconnectedNotification: DisconnectedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/disconnected',
    }

    await this.mqttAdapter.publish(
      `$mcp-client/presence/${this.mcpClientId}`,
      JSON.stringify(disconnectedNotification),
      {
        userProperties: {
          'MCP-COMPONENT-TYPE': 'mcp-client',
          'MCP-MQTT-CLIENT-ID': this.mcpClientId,
        },
      },
    )

    // Clear pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout)
      request.reject(new Error('Client disconnected'))
    }
    this.pendingRequests.clear()

    await this.mqttAdapter.disconnect()
    this.emit('disconnected')
  }

  private handleBrokerSuggestions(): void {
    // Handle broker-suggested server name filters from CONNACK user properties
    try {
      const connackProperties = this.mqttAdapter.getConnackProperties()
      if (connackProperties?.userProperties) {
        // Handle MCP-SERVER-NAME-FILTERS suggestion
        const mcpServerNameFilters = connackProperties.userProperties['MCP-SERVER-NAME-FILTERS']
        if (mcpServerNameFilters) {
          const filters = JSON.parse(mcpServerNameFilters)
          if (Array.isArray(filters) && filters.length > 0) {
            this.serverNameFilter = filters[0] // Use first suggested filter
            console.log(`Using broker-suggested server name filter: ${this.serverNameFilter}`)
          }
        }

        // Handle MCP-RBAC information
        const mcpRbac = connackProperties.userProperties['MCP-RBAC']
        if (mcpRbac) {
          const rbacInfo = JSON.parse(mcpRbac)
          this.emit('brokerRbacInfo', rbacInfo)
          console.log('Received broker RBAC information:', rbacInfo)
        }
      }
    } catch (error) {
      console.warn('Failed to process broker suggestions:', error)
    }
  }

  private async discoverServers(): Promise<void> {
    // Servers will publish their presence when they come online
    // We're already subscribed to the presence topic
  }

  async initializeServer(serverId: string): Promise<ServerInfo> {
    const serverInfo = this.discoveredServers.get(serverId)
    if (!serverInfo) {
      throw new Error(`Server not discovered: ${serverId}`)
    }

    const initializeRequest = createRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: this.config.capabilities?.roots?.listChanged ?? false,
        },
        sampling: this.config.capabilities?.sampling ?? {},
      },
      clientInfo: { name: this.config.name, version: this.config.version },
    })

    // Send initialize request to server control topic
    const controlTopic = `$mcp-server/${serverId}/${serverInfo.serverName}`
    const response = await this.sendRequest(controlTopic, initializeRequest, serverId)

    // Update server info with initialization response
    const updatedServerInfo: ServerInfo = {
      ...serverInfo,
      name: response.result.serverInfo.name,
      version: response.result.serverInfo.version,
      capabilities: response.result.capabilities,
    }

    this.connectedServers.set(serverId, updatedServerInfo)

    // Send initialized notification
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }

    const rpcTopic = `$mcp-rpc/${this.mcpClientId}/${serverId}/${serverInfo.serverName}`
    await this.mqttAdapter.publish(rpcTopic, JSON.stringify(initializedNotification), {
      userProperties: {
        'MCP-COMPONENT-TYPE': 'mcp-client',
        'MCP-MQTT-CLIENT-ID': this.mcpClientId,
      },
    })

    this.emit('serverInitialized', updatedServerInfo)
    return updatedServerInfo
  }

  async listTools(serverId: string): Promise<Tool[]> {
    const request = createRequest('tools/list', {})
    const response = await this.sendRpcRequest(serverId, request)
    return response.result.tools
  }

  async callTool(serverId: string, name: string, args?: Record<string, any>): Promise<any> {
    const request = createRequest('tools/call', {
      name,
      arguments: args,
    })

    // Validate request format according to MCP specification
    CallToolRequestSchema.parse(request)

    const response = await this.sendRpcRequest(serverId, request)
    return response.result
  }

  async listResources(serverId: string): Promise<Resource[]> {
    const request = createRequest('resources/list', {})
    const response = await this.sendRpcRequest(serverId, request)
    return response.result.resources
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const request = createRequest('resources/read', { uri })

    // Validate request format according to MCP specification
    ReadResourceRequestSchema.parse(request)

    const response = await this.sendRpcRequest(serverId, request)
    return response.result
  }

  async ping(serverId: string): Promise<boolean> {
    const request = createRequest('ping', {})
    const response = await this.sendRpcRequest(serverId, request)
    return response.result.pong === true
  }

  private async sendRpcRequest(serverId: string, request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const serverInfo = this.connectedServers.get(serverId)
    if (!serverInfo) {
      throw new Error(`Server not connected: ${serverId}`)
    }

    const rpcTopic = `$mcp-rpc/${this.mcpClientId}/${serverId}/${serverInfo.serverName}`
    return this.sendRequest(rpcTopic, request, serverId)
  }

  private getRequestTimeout(method: string): number {
    // Recommended default timeout values per MCP over MQTT specification
    const timeouts: Record<string, number> = {
      initialize: 30000,
      ping: 10000,
      'roots/list': 30000,
      'resources/list': 30000,
      'tools/list': 30000,
      'prompts/list': 30000,
      'prompts/get': 30000,
      'sampling/createMessage': 60000,
      'resources/read': 30000,
      'resources/templates/list': 30000,
      'resources/subscribe': 30000,
      'tools/call': 60000,
      'completion/complete': 60000,
      'logging/setLevel': 30000,
    }
    return timeouts[method] || 30000 // Default to 30 seconds
  }

  private async sendRequest(topic: string, request: JSONRPCRequest, _serverId?: string): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const timeoutMs = this.getRequestTimeout(request.method)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new Error(`Request timeout: ${request.method} (${timeoutMs}ms)`))
      }, timeoutMs)

      this.pendingRequests.set(request.id, { resolve, reject, timeout })

      this.mqttAdapter
        .publish(topic, JSON.stringify(request), {
          userProperties: {
            'MCP-COMPONENT-TYPE': 'mcp-client',
            'MCP-MQTT-CLIENT-ID': this.mcpClientId,
          },
        })
        .catch((error) => {
          this.pendingRequests.delete(request.id)
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  private async handleMessage(topic: string, message: string, _packet: any): Promise<void> {
    try {
      if (topic.startsWith('$mcp-server/presence/')) {
        await this.handleServerPresence(topic, message)
      } else if (topic.startsWith('$mcp-server/capability/')) {
        this.handleServerCapabilityChange(topic, message)
      } else if (topic.startsWith('$mcp-rpc/')) {
        this.handleRpcMessage(topic, message)
      }
    } catch (error) {
      console.error('Failed to handle message:', error)
    }
  }

  private async handleServerPresence(topic: string, message: string): Promise<void> {
    const parts = topic.split('/')
    if (parts.length < 4) return

    const serverId = parts[2]
    if (!serverId) return // Guard against undefined serverId

    // const serverName = parts.slice(3).join('/') // Reconstruct hierarchical server name

    if (!message.trim()) {
      // Empty message means server went offline
      this.discoveredServers.delete(serverId)
      this.connectedServers.delete(serverId)
      this.emit('serverDisconnected', serverId)
      return
    }

    try {
      const parsedMessage = JSON.parse(message)
      const notification: ServerOnlineNotification = ServerOnlineNotificationSchema.parse(parsedMessage)

      const serverInfo: ServerInfo = {
        serverId,
        serverName: notification.params.server_name,
        description: notification.params.description,
        name: notification.params.server_name,
        version: '1.0.0', // Will be updated during initialization
        capabilities: {
          logging: {},
          prompts: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          tools: { listChanged: false },
        },
        ...(notification.params.meta?.rbac && { rbac: notification.params.meta.rbac }),
      }

      this.discoveredServers.set(serverId, serverInfo)
      this.emit('serverDiscovered', serverInfo)
    } catch (error) {
      console.error('Failed to parse server presence message:', error)
    }
  }

  private handleServerCapabilityChange(topic: string, message: string): void {
    const parts = topic.split('/')
    if (parts.length < 4) return

    const serverId = parts[2]
    if (!serverId) return // Guard against undefined serverId

    try {
      const parsedMessage = JSON.parse(message)
      this.emit('serverCapabilityChanged', serverId, parsedMessage.method)
    } catch (error) {
      console.error('Failed to parse capability change message:', error)
    }
  }

  private handleRpcMessage(topic: string, message: string): void {
    try {
      const parsedMessage = JSON.parse(message)

      if (parsedMessage.id && this.pendingRequests.has(parsedMessage.id)) {
        // This is a response to our request
        const pendingRequest = this.pendingRequests.get(parsedMessage.id)!
        this.pendingRequests.delete(parsedMessage.id)
        clearTimeout(pendingRequest.timeout)

        if (parsedMessage.error) {
          pendingRequest.reject(new McpError(parsedMessage.error.code, parsedMessage.error.message))
        } else {
          pendingRequest.resolve(parsedMessage)
        }
      } else if (parsedMessage.method) {
        // Check if it's a disconnect notification
        if (parsedMessage.method === 'notifications/disconnected') {
          try {
            DisconnectedNotificationSchema.parse(parsedMessage)
            // Handle server disconnect - clean up this server connection
            const parts = topic.split('/')
            if (parts.length >= 3) {
              const serverId = parts[2]
              if (serverId) {
                this.connectedServers.delete(serverId)
                this.emit('serverDisconnected', serverId)
              }
            }
            return
          } catch (error) {
            console.error('Invalid disconnect notification:', error)
          }
        }

        // This is a notification or request from server
        this.emit('serverNotification', parsedMessage)
      }
    } catch (error) {
      console.error('Failed to parse RPC message:', error)
    }
  }

  getDiscoveredServers(): ServerInfo[] {
    return Array.from(this.discoveredServers.values())
  }

  getConnectedServers(): ServerInfo[] {
    return Array.from(this.connectedServers.values())
  }

  isServerConnected(serverId: string): boolean {
    return this.connectedServers.has(serverId)
  }
}

export function createMcpClient(config: McpMqttClientConfig): McpMqttClient {
  return new McpMqttClient(config)
}
