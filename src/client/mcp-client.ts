import { EventEmitter } from 'events'
import type {
  McpMqttClientConfig,
  Tool,
  Resource,
  JSONRPCRequest,
  JSONRPCResponse,
  CallToolRequest,
  ReadResourceRequest,
} from '../types.js'
import { UniversalMqttAdapter } from '../shared/mqtt-adapter.js'
import { createRequest, generateId, McpError } from '../shared/utils.js'

export interface ServerInfo {
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
  topics: {
    request: string
    response: string
  }
}

export class McpMqttClient extends EventEmitter {
  private mqttAdapter: UniversalMqttAdapter
  private config: McpMqttClientConfig
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }
  >()
  private discoveredServers = new Map<string, ServerInfo>()
  private connectedServers = new Map<string, ServerInfo>()

  constructor(config: McpMqttClientConfig) {
    super()
    this.config = config
    this.mqttAdapter = new UniversalMqttAdapter(config.mqtt)
  }

  async connect(): Promise<void> {
    try {
      await this.mqttAdapter.connect()

      // Subscribe to server discovery topic
      await this.mqttAdapter.subscribe('mcp/servers/+/responses')

      this.mqttAdapter.on('message', (topic, payload) => {
        this.handleMessage(topic, payload.toString())
      })

      this.mqttAdapter.on('error', (error) => {
        this.emit('error', error)
      })

      // Start server discovery
      await this.discoverServers()

      this.emit('connected')
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    // Cleanup pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Client disconnected'))
    }
    this.pendingRequests.clear()

    await this.mqttAdapter.disconnect()
    this.emit('disconnected')
  }

  private async discoverServers(): Promise<void> {
    // This is a simplified discovery mechanism
    // In a real implementation, you might use MQTT service discovery or a registry
    this.emit('discovery:started')
  }

  async connectToServer(serverName: string): Promise<ServerInfo> {
    const server = this.discoveredServers.get(serverName)
    if (!server) {
      throw new Error(`Server not found: ${serverName}`)
    }

    try {
      // Send initialize request
      const initRequest = createRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: this.config.capabilities?.roots ?? {},
          sampling: this.config.capabilities?.sampling ?? {},
        },
        clientInfo: this.config.clientInfo,
      })

      const response = await this.sendRequest(server.topics.request, initRequest)

      if (response.error) {
        throw new McpError(response.error.code, response.error.message, response.error.data)
      }

      // Update server info with initialization response
      const updatedServer: ServerInfo = {
        ...server,
        ...response.result,
      }

      this.connectedServers.set(serverName, updatedServer)
      this.emit('server:connected', updatedServer)

      return updatedServer
    } catch (error) {
      this.emit('server:error', serverName, error)
      throw error
    }
  }

  async listTools(serverName: string): Promise<Tool[]> {
    const server = this.connectedServers.get(serverName)
    if (!server) {
      throw new Error(`Not connected to server: ${serverName}`)
    }

    const request = createRequest('tools/list')
    const response = await this.sendRequest(server.topics.request, request)

    if (response.error) {
      throw new McpError(response.error.code, response.error.message, response.error.data)
    }

    return response.result?.tools ?? []
  }

  async callTool(
    serverName: string,
    toolName: string,
    args?: Record<string, any>,
  ): Promise<{
    content: Array<{
      type: string
      text?: string
      data?: string
      mimeType?: string
    }>
    isError?: boolean
  }> {
    const server = this.connectedServers.get(serverName)
    if (!server) {
      throw new Error(`Not connected to server: ${serverName}`)
    }

    const request: CallToolRequest = {
      jsonrpc: '2.0',
      id: generateId(),
      method: 'tools/call',
      params: {
        name: toolName,
        ...(args && { arguments: args }),
      },
    }

    const response = await this.sendRequest(server.topics.request, request)

    if (response.error) {
      throw new McpError(response.error.code, response.error.message, response.error.data)
    }

    return response.result
  }

  async listResources(serverName: string): Promise<Resource[]> {
    const server = this.connectedServers.get(serverName)
    if (!server) {
      throw new Error(`Not connected to server: ${serverName}`)
    }

    const request = createRequest('resources/list')
    const response = await this.sendRequest(server.topics.request, request)

    if (response.error) {
      throw new McpError(response.error.code, response.error.message, response.error.data)
    }

    return response.result?.resources ?? []
  }

  async readResource(
    serverName: string,
    uri: string,
  ): Promise<{
    contents: Array<{
      uri: string
      mimeType?: string
      text?: string
      blob?: string
    }>
  }> {
    const server = this.connectedServers.get(serverName)
    if (!server) {
      throw new Error(`Not connected to server: ${serverName}`)
    }

    const request: ReadResourceRequest = {
      jsonrpc: '2.0',
      id: generateId(),
      method: 'resources/read',
      params: {
        uri,
      },
    }

    const response = await this.sendRequest(server.topics.request, request)

    if (response.error) {
      throw new McpError(response.error.code, response.error.message, response.error.data)
    }

    return response.result
  }

  private async sendRequest(topic: string, request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new Error(`Request timeout: ${request.method}`))
      }, 30000)

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout,
      })

      this.mqttAdapter.publish(topic, JSON.stringify(request)).catch((error) => {
        this.pendingRequests.delete(request.id)
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  private handleMessage(topic: string, message: string): void {
    try {
      const parsedMessage = JSON.parse(message) as JSONRPCResponse

      // Handle response to pending request
      if (parsedMessage.id && this.pendingRequests.has(parsedMessage.id)) {
        const pending = this.pendingRequests.get(parsedMessage.id)!
        this.pendingRequests.delete(parsedMessage.id)
        clearTimeout(pending.timeout)
        pending.resolve(parsedMessage)
        return
      }

      // Handle server discovery
      if (topic.includes('/responses')) {
        const serverName = this.extractServerNameFromTopic(topic)
        if (serverName && !this.discoveredServers.has(serverName)) {
          const serverInfo: ServerInfo = {
            name: serverName,
            version: '1.0.0', // This would come from actual discovery
            capabilities: {}, // This would come from actual discovery
            topics: {
              request: `mcp/servers/${serverName}/requests`,
              response: topic,
            },
          }

          this.discoveredServers.set(serverName, serverInfo)
          this.emit('server:discovered', serverInfo)
        }
      }
    } catch (error) {
      console.error('Failed to handle message:', error)
    }
  }

  private extractServerNameFromTopic(topic: string): string | null {
    const match = topic.match(/mcp\/servers\/([^\/]+)\/responses/)
    return match?.[1] ?? null
  }

  getDiscoveredServers(): ServerInfo[] {
    return Array.from(this.discoveredServers.values())
  }

  getConnectedServers(): ServerInfo[] {
    return Array.from(this.connectedServers.values())
  }

  onServerDiscovered(callback: (server: ServerInfo) => void): void {
    this.on('server:discovered', callback)
  }

  onServerConnected(callback: (server: ServerInfo) => void): void {
    this.on('server:connected', callback)
  }
}

export function createMcpClient(config: McpMqttClientConfig): McpMqttClient {
  return new McpMqttClient(config)
}
