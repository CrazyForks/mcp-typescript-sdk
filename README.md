# @emqx-ai/mcp-mqtt-sdk

A TypeScript SDK for implementing Model Context Protocol (MCP) over MQTT, supporting both browser and Node.js environments with full type safety and automatic environment detection.

## Features

- 🚀 **Universal**: Works seamlessly in browser (WebSocket) and Node.js (TCP) environments
- 🔒 **Type Safe**: Full TypeScript support with Zod schema validation for MCP protocol
- 🌐 **MQTT Transport**: Uses MQTT as the transport layer for reliable MCP communication
- 🏗️ **Constructor-Based**: Clean object-oriented API with proper TypeScript classes
- 📋 **Standards Compliant**: Follows MCP specification v2024-11-05
- 🔧 **Tool & Resource Support**: Complete support for MCP tools and resources
- 🔍 **Auto Discovery**: Automatic server discovery over MQTT topics
- 🌍 **Environment Detection**: Automatic browser/Node.js detection with appropriate defaults

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
  mqtt: {
    host: 'localhost',
    port: 1883, // Node.js default; browser uses 8084 with WebSocket
  },
  serverInfo: {
    name: 'My MCP Server',
    version: '1.0.0',
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
  mqtt: {
    host: 'localhost',
    port: 1883, // Node.js default; browser uses 8084 with WebSocket
  },
  clientInfo: {
    name: 'My MCP Client',
    version: '1.0.0',
  },
})

// Set up server discovery handler
client.onServerDiscovered(async (server) => {
  console.log('📡 Discovered server:', server.name)

  try {
    // Connect to the discovered server
    await client.connectToServer(server.name)
    console.log('✅ Connected to:', server.name)

    // List available tools
    const tools = await client.listTools(server.name)
    console.log('🔧 Available tools:', tools.map(t => t.name))

    // Call a tool
    if (tools.some(t => t.name === 'greet')) {
      const result = await client.callTool(server.name, 'greet', {
        name: 'World',
        language: 'es'
      })
      console.log('🎉 Tool result:', result.content[0]?.text)
    }

    // List and read resources
    const resources = await client.listResources(server.name)
    console.log('📚 Available resources:', resources.map(r => r.uri))

    if (resources.some(r => r.uri === 'config://app-settings')) {
      const config = await client.readResource(server.name, 'config://app-settings')
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
  mqtt: MqttConnectionOptions
  serverInfo: {
    name: string
    version: string
  }
  capabilities?: {
    prompts?: { listChanged?: boolean }
    resources?: { subscribe?: boolean; listChanged?: boolean }
    tools?: { listChanged?: boolean }
  };
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

#### Constructor

```typescript
new McpMqttClient(config: McpMqttClientConfig)
```

**Configuration:**
```typescript
interface McpMqttClientConfig {
  mqtt: MqttConnectionOptions
  clientInfo: {
    name: string
    version: string
  };
  capabilities?: {
    roots?: { listChanged?: boolean }
    sampling?: Record<string, any>
  };
}
```

#### Methods

##### Connection Management
```typescript
await client.connect()           // Connect to MQTT broker and start discovery
await client.disconnect()        // Disconnect from broker
await client.connectToServer(serverName)  // Connect to a specific server
```

##### Tool Operations
```typescript
const tools = await client.listTools(serverName)
const result = await client.callTool(serverName, toolName, args)
```

##### Resource Operations
```typescript
const resources = await client.listResources(serverName)
const data = await client.readResource(serverName, uri)
```

##### Discovery
```typescript
const discovered = client.getDiscoveredServers()
const connected = client.getConnectedServers()
```

#### Events

```typescript
client.onServerDiscovered((server) => {
  console.log('Found server:', server.name)
})

client.onServerConnected((server) => {
  console.log('Connected to:', server.name)
})

client.on('connected', () => console.log('Client connected'))
client.on('disconnected', () => console.log('Client disconnected'))
client.on('error', (error) => console.error('Client error:', error))
```

## MQTT Configuration

The SDK supports comprehensive MQTT connection options:

```typescript
interface MqttConnectionOptions {
  host: string
  port?: number              // 1883 (Node.js) / 8084 (browser)
  clientId?: string          // Auto-generated if not provided
  username?: string
  password?: string
  clean?: boolean            // Clean session (default: true)
  keepalive?: number         // Keep-alive interval in seconds
  connectTimeout?: number    // Connection timeout in milliseconds
  reconnectPeriod?: number   // Reconnection period in milliseconds
  will?: {                    // Last Will Testament
    topic: string
    payload: string | Buffer
    qos?: 0 | 1 | 2
    retain?: boolean
  };
}
```

### Environment-Specific Defaults

The SDK automatically detects the runtime environment and applies appropriate defaults:

#### Browser Environment
- **Transport**: WebSocket (wss://)
- **Default Port**: 8084
- **URL Format**: `wss://host:port/mqtt`

#### Node.js Environment
- **Transport**: TCP
- **Default Port**: 1883
- **URL Format**: `mqtt://host:port`

## Advanced Usage

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

## Examples

The SDK includes comprehensive examples in the `examples/` directory:

- **[node-server.ts](examples/node-server.ts)** - Full-featured Node.js MCP server
  - System information tools
  - File system tools
  - Environment and server info resources
  - Command-line argument parsing
  - Graceful shutdown handling

- **[node-client.ts](examples/node-client.ts)** - Complete Node.js MCP client
  - Server discovery and connection
  - Tool testing and validation
  - Resource reading and processing
  - Error handling and recovery



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

The SDK uses a structured topic hierarchy:

```
mcp/
├── servers/
│   └── {server-name}/
│       ├── requests     # Client → Server
│       └── responses    # Server → Client
```

### Message Flow

1. **Discovery**: Client subscribes to `mcp/servers/+/responses`
2. **Connection**: Client sends `initialize` request to server's request topic
3. **Operations**: Client sends tool calls and resource reads to server
4. **Responses**: Server responds on its response topic

### Error Codes

The SDK follows JSON-RPC 2.0 error codes:

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000` to `-32099`: Implementation-defined server errors

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run the test suite (`npm test`)
5. Submit a pull request

## License

Apache License 2.0. See [LICENSE](LICENSE) file for details.
