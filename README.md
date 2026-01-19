# @emqx-ai/mcp-mqtt-sdk

A TypeScript SDK for implementing Model Context Protocol (MCP) over MQTT, supporting both browser and Node.js environments with full type safety and automatic environment detection.

## 🎯 Live Demo

See this SDK in action! Check out our **[MCP AI Companion Demo](https://github.com/emqx/mcp-ai-companion-demo)** - a real-world implementation using both Python and TypeScript with this SDK to create an AI agent that can:

- 🎤 Control browser audio/video functionality
- 😊 Switch facial expressions and emotions
- 💬 Power interactive conversational experiences
- 🌐 Demonstrate cross-platform MCP communication

This demo showcases how to build sophisticated AI agents using MCP over MQTT for seamless browser control and interaction.

## Features

- 🚀 **Universal**: Works seamlessly in browser (WebSocket) and Node.js (TCP) environments
- 🔒 **Type Safe**: Full TypeScript support with Zod schema validation for MCP protocol
- 🌐 **MQTT Transport**: Uses MQTT as the transport layer for reliable MCP communication
- 🏗️ **Constructor-Based**: Clean object-oriented API with proper TypeScript classes
- 📋 **Standards Compliant**: Follows MCP specification v2024-11-05
- 🔧 **Tool & Resource Support**: Complete support for MCP tools and resources
- 🔍 **Auto Discovery**: Automatic server discovery over MQTT topics
- 🌍 **Environment Detection**: Automatic browser/Node.js detection with appropriate defaults

## Requirements

- Node.js >= 18

## Installation

```bash
npm install @emqx-ai/mcp-mqtt-sdk
```

## Quick Start

### Creating an MCP Server

```typescript
import { McpMqttServer } from '@emqx-ai/mcp-mqtt-sdk'

// Create server instance
const server = new McpMqttServer({
  // MQTT connection
  host: 'mqtt://localhost:1883',

  // Server identification
  serverId: 'unique-server-id-123',
  serverName: 'myapp/greeting-server',  // Hierarchical naming

  // Server information
  name: 'My MCP Server',
  version: '1.0.0',

  // Optional configuration
  description: 'A sample MCP server providing greeting tools',
  capabilities: {
    tools: { listChanged: true },
    resources: { listChanged: true, subscribe: false },
  },
})

// Add a tool
server.tool(
  'greet',
  'Greet someone with a personalized message',
  {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the person to greet'
      },
      language: {
        type: 'string',
        enum: ['en', 'es', 'fr'],
        description: 'Language for greeting'
      }
    },
    required: ['name'],
  },
  async ({ name, language = 'en' }) => {
    const greetings = {
      en: `Hello, ${name}!`,
      es: `¡Hola, ${name}!`,
      fr: `Bonjour, ${name}!`
    }

    return {
      content: [{
        type: 'text',
        text: greetings[language] || greetings.en,
      }],
    }
  }
)

// Add a resource
server.resource(
  'config://app-settings',
  'Application Settings',
  async () => ({
    contents: [{
      uri: 'config://app-settings',
      mimeType: 'application/json',
      text: JSON.stringify({
        theme: 'dark',
        language: 'en',
        notifications: true
      }, null, 2),
    }],
  }),
  {
    description: 'Current application configuration',
    mimeType: 'application/json',
  }
)

// Event handlers
server.on('ready', () => {
  console.log('Server is ready!')
  console.log('Topics:', server.getTopics())
})

server.on('error', (error) => {
  console.error('Server error:', error)
})

// Start the server
await server.start()
```

### Creating an MCP Client

```typescript
import { McpMqttClient } from '@emqx-ai/mcp-mqtt-sdk'

// Create client instance
const client = new McpMqttClient({
  // MQTT connection
  host: 'mqtt://localhost:1883',

  // Client information
  name: 'My MCP Client',
  version: '1.0.0',
})

// Set up server discovery handler
client.on('serverDiscovered', async (server) => {
  console.log('📡 Discovered server:', server.name, '(ID:', server.serverId, ')')

  try {
    // Connect to the discovered server using serverId
    await client.initializeServer(server.serverId)
    console.log('✅ Connected to:', server.name)

    // List available tools using serverId
    const tools = await client.listTools(server.serverId)
    console.log('🔧 Available tools:', tools.map(t => t.name))

    // Call a tool using serverId
    if (tools.some(t => t.name === 'greet')) {
      const result = await client.callTool(server.serverId, 'greet', {
        name: 'World',
        language: 'es'
      })
      console.log('🎉 Tool result:', result.content[0]?.text)
    }

    // List and read resources using serverId
    const resources = await client.listResources(server.serverId)
    console.log('📚 Available resources:', resources.map(r => r.uri))

    if (resources.some(r => r.uri === 'config://app-settings')) {
      const config = await client.readResource(server.serverId, 'config://app-settings')
      console.log('📄 Config:', config.contents[0]?.text)
    }
  } catch (error) {
    console.error('❌ Error with server:', server.name, error)
  }
})

// Connect and start discovery
await client.connect()

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.disconnect()
  process.exit(0)
})
```

## API Reference

### McpMqttServer

#### Constructor

```typescript
new McpMqttServer(config: McpMqttServerConfig)
```

**Configuration:**

```typescript
interface McpMqttServerConfig {
  // MQTT connection settings
  host: string
  username?: string
  password?: string

  // Server identification (required)
  serverId: string      // Unique server ID (MQTT client ID)
  serverName: string    // Hierarchical server name (e.g., "app/feature/server")

  // Server information (required)
  name: string
  version: string

  // Optional configuration
  description?: string     // Server description
  capabilities?: {
    prompts?: { listChanged?: boolean }
    resources?: { subscribe?: boolean; listChanged?: boolean }
    tools?: { listChanged?: boolean }
  }
  rbac?: {               // Optional role-based access control
    roles: Array<{
      name: string
      description: string
      allowed_methods: string[]
      allowed_tools: string[] | "all"
      allowed_resources: string[] | "all"
    }>
  }
}
```

#### Methods

##### `tool(name, description, inputSchema, handler)`

Register a tool that clients can call.

```typescript
server.tool(
  'calculate',
  'Perform mathematical calculations',
  {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate'
      },
    },
    required: ['expression'],
  },
  async ({ expression }) => {
    try {
      // Safe evaluation - implement your own parser
      const result = evaluateExpression(expression)
      return {
        content: [{
          type: 'text',
          text: `${expression} = ${result}`,
        }],
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      }
    }
  }
)
```

##### `resource(uri, name, handler, options?)`

Register a resource that clients can read.

```typescript
server.resource(
  'file://logs/app.log',
  'Application Logs',
  async () => {
    const logs = await readLogFile()
    return {
      contents: [{
        uri: 'file://logs/app.log',
        mimeType: 'text/plain',
        text: logs,
      }],
    }
  },
  {
    description: 'Current application log entries',
    mimeType: 'text/plain',
  }
)
```

##### `start()` / `stop()`

Control server lifecycle.

```typescript
await server.start()  // Start listening for requests
await server.stop()   // Gracefully shutdown
```

##### `getTopics()`

Get MQTT topics used by this server.

```typescript
const { request, response } = server.getTopics()
```

#### Events

```typescript
server.on('ready', () => console.log('Server ready'))
server.on('error', (error) => console.error('Server error:', error))
server.on('closed', () => console.log('Server closed'))
```

### McpMqttClient

#### Client Constructor

```typescript
new McpMqttClient(config: McpMqttClientConfig)
```

**Configuration:**

```typescript
interface McpMqttClientConfig {
  // MQTT connection settings
  host: string
  clientId?: string
  username?: string
  password?: string
  clean?: boolean
  keepalive?: number
  connectTimeout?: number
  reconnectPeriod?: number

  // Client information (required)
  name: string
  version: string

  // Optional configuration
  capabilities?: {
    roots?: { listChanged?: boolean }
    sampling?: Record<string, any>
  }

  // Advanced MQTT settings (optional)
  will?: {
    topic: string
    payload: string | Buffer
    qos?: 0 | 1 | 2
    retain?: boolean
  }
  properties?: Record<string, any>
}
```

#### Client Methods

##### Connection Management

```typescript
await client.connect()           // Connect to MQTT broker and start discovery
await client.disconnect()        // Disconnect from broker
await client.initializeServer(serverId)  // Initialize connection to a specific server
```

##### Tool Operations

```typescript
const tools = await client.listTools(serverId)
const result = await client.callTool(serverId, toolName, args)
```

##### Resource Operations

```typescript
const resources = await client.listResources(serverId)
const data = await client.readResource(serverId, uri)
```

##### Discovery

```typescript
const discovered = client.getDiscoveredServers()
const connected = client.getConnectedServers()
```

#### Client Events

```typescript
client.on('serverDiscovered', (server) => {
  console.log('Found server:', server.name, 'ID:', server.serverId)
})

client.on('serverInitialized', (server) => {
  console.log('Connected to:', server.name)
})

client.on('serverDisconnected', (serverId) => {
  console.log('Server disconnected:', serverId)
})

client.on('connected', () => console.log('Client connected'))
client.on('disconnected', () => console.log('Client disconnected'))
client.on('error', (error) => console.error('Client error:', error))
```

## MQTT Configuration

The SDK supports comprehensive MQTT connection options:

```typescript
interface MqttConnectionOptions {
  host: string               // Complete connection URL (e.g., ws://localhost:8083, wss://broker.emqx.io:8084)
  clientId?: string          // Auto-generated if not provided
  username?: string
  password?: string
  clean?: boolean            // Clean session (default: true)
  keepalive?: number         // Keep-alive interval in seconds
  connectTimeout?: number    // Connection timeout in milliseconds
  reconnectPeriod?: number   // Reconnection period in milliseconds
  will?: {                   // Last Will Testament
    topic: string
    payload: string | Buffer
    qos?: 0 | 1 | 2
    retain?: boolean
  };
}
```

### Connection Examples

The `host` parameter should be a complete connection URL:

```typescript
// WebSocket connections (browser)
host: 'ws://localhost:8083'
host: 'wss://broker.emqx.io:8084'

// TCP connections (Node.js)
host: 'mqtt://localhost:1883'
host: 'mqtts://broker.emqx.io:8883'
```

## Advanced Usage

### Accessing Underlying MQTT Client

Both server and client provide `getMqttClient()` method to access the underlying MQTT client for custom pub/sub operations:

```typescript
const mqttClient = server.getMqttClient() // or client.getMqttClient()
if (mqttClient) {
  mqttClient.subscribe('custom/topic', { qos: 1 })
  mqttClient.publish('custom/topic', 'Hello World')
}
```

### Custom Tool Validation

```typescript
import { z } from 'zod'

// Define schema for tool parameters
const CalculateSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number(),
})

server.tool(
  'calculate',
  'Perform arithmetic operations',
  {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['operation', 'a', 'b'],
  },
  async (params) => {
    // Validate with Zod
    const { operation, a, b } = CalculateSchema.parse(params)

    let result: number
    switch (operation) {
      case 'add': result = a + b; break
      case 'subtract': result = a - b; break
      case 'multiply': result = a * b; break
      case 'divide':
        if (b === 0) throw new Error('Division by zero')
        result = a / b
        break
    }

    return {
      content: [{
        type: 'text',
        text: `${a} ${operation} ${b} = ${result}`,
      }],
    }
  }
)
```

### Error Handling

```typescript
// Server-side error handling
server.tool('risky-operation', 'An operation that might fail', schema, async (params) => {
  try {
    const result = await performRiskyOperation(params)
    return {
      content: [{ type: 'text', text: `Success: ${result}` }],
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Operation failed: ${error.message}` }],
      isError: true, // Mark as error response
    }
  }
})

// Client-side error handling
try {
  const result = await client.callTool(serverName, 'risky-operation', params)
  if (result.isError) {
    console.error('Tool returned error:', result.content[0]?.text)
  } else {
    console.log('Success:', result.content[0]?.text)
  }
} catch (error) {
  console.error('Tool call failed:', error.message)
}
```

### Resource Streaming

```typescript
// Server: Streaming resource
server.resource(
  'stream://live-data',
  'Live Data Stream',
  async () => {
    const chunks = await getLiveDataChunks()
    return {
      contents: chunks.map((chunk, index) => ({
        uri: `stream://live-data#${index}`,
        mimeType: 'application/json',
        text: JSON.stringify(chunk),
      })),
    }
  }
)

// Client: Read streaming resource
const stream = await client.readResource(serverName, 'stream://live-data')
for (const content of stream.contents) {
  const data = JSON.parse(content.text!)
  processStreamChunk(data)
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Build in watch mode
npm run build:watch

# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## Protocol Details

### MQTT Topic Structure

The SDK follows the official MCP over MQTT specification topic hierarchy:

```text
MCP over MQTT Topic Structure:

🗂️ Server Topics:
├── $mcp-server/{server-id}/{server-name}              # Control topic (initialization)
├── $mcp-server/capability/{server-id}/{server-name}   # Capability change notifications
└── $mcp-server/presence/{server-id}/{server-name}     # Server presence (online/offline)

🗂️ Client Topics:
├── $mcp-client/capability/{mcp-client-id}             # Client capability changes
└── $mcp-client/presence/{mcp-client-id}               # Client presence

🗂️ RPC Communication:
└── $mcp-rpc/{mcp-client-id}/{server-id}/{server-name} # Bidirectional RPC communication

Example Topics:
- Control: $mcp-server/server-123/myapp/greeting-server
- Capability: $mcp-server/capability/server-123/myapp/greeting-server
- Presence: $mcp-server/presence/server-123/myapp/greeting-server
- RPC: $mcp-rpc/client-456/server-123/myapp/greeting-server
```

### Message Flow

1. **Service Discovery**: Client subscribes to `$mcp-server/presence/+/#`
2. **Server Registration**: Server publishes presence to `$mcp-server/presence/{server-id}/{server-name}`
3. **Initialization**: Client sends `initialize` request to `$mcp-server/{server-id}/{server-name}`
4. **RPC Communication**: Bidirectional communication via `$mcp-rpc/{client-id}/{server-id}/{server-name}`

### Error Codes

The SDK follows JSON-RPC 2.0 error codes:

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000` to `-32099`: Implementation-defined server errors

## Other Language SDKs

Looking for MCP over MQTT support in other languages?

- **[Python SDK](https://github.com/emqx/mcp-python-sdk)** - MCP over MQTT implementation for Python
- **[Erlang SDK](https://github.com/emqx/mcp-mqtt-erl)** - MCP over MQTT implementation for Erlang
- **[Paho MCP over MQTT](https://github.com/mqtt-ai/paho-mcp-over-mqtt)** - MCP over MQTT implementation in C
- **[ESP MCP over MQTT](https://github.com/mqtt-ai/esp-mcp-over-mqtt)** - MCP over MQTT for ESP32/embedded devices in C

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run the test suite (`npm test`)
5. Submit a pull request

## License

Apache License 2.0. See [LICENSE](LICENSE) file for details.
