// Main exports for the MCP over MQTT SDK
export * from './types.js'
export * from './shared/utils.js'

// Server exports
export { McpMqttServer, createMcpServer } from './server/index.js'
export type { ToolHandler, ResourceHandler } from './server/index.js'

// Client exports
export { McpMqttClient, createMcpClient } from './client/index.js'
export type { ServerInfo } from './client/index.js'

// Version
export const VERSION = '0.0.1'
