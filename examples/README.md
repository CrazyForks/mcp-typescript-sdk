# MCP over MQTT SDK Examples

This directory contains example implementations showing how to use the `@emqx-ai/mcp-mqtt-sdk` with both server and client implementations.

## Prerequisites

Before running the examples, make sure to build the project:

```bash
# From the project root directory
npm run build
```

## Available Examples

### 1. Node.js Server (`node-server.ts`)

A comprehensive Node.js MCP server that demonstrates:
- Server configuration using constructor pattern (`new McpMqttServer()`)
- Tool registration with multiple examples:
  - `system-info`: Get Node.js system information
  - `file-exists`: Check if a file exists on filesystem
  - `echo`: Echo back input messages
  - `time`: Get current timestamp
- Resource registration:
  - `process:env`: Environment variables (JSON)
  - `server:info`: Server information (JSON)
- Error handling and graceful shutdown
- Command-line argument parsing

### 2. Node.js Client (`node-client.ts`)

A comprehensive Node.js MCP client that demonstrates:
- Client configuration using constructor pattern (`new McpMqttClient()`)
- Automatic server discovery over MQTT
- Server connection and initialization
- Tool listing and execution
- Resource listing and reading
- Comprehensive testing of discovered servers
- Error handling and recovery

## Running the Examples

### Basic Usage

1. **Terminal 1** - Start the server:
```bash
node examples/node-server.ts
```

2. **Terminal 2** - Run the client:
```bash
node examples/node-client.ts
```

The client will automatically discover the server and test all available tools and resources.

### With Custom Configuration

**Server with custom options:**
```bash
node examples/node-server.ts --host localhost --port 1883 --server-name "My Demo Server"
```

**Client with custom options:**
```bash
node examples/node-client.ts --host localhost --port 1883 --client-name "My Demo Client"
```

## Command Line Options

### Server Options (`node-server.ts`)

- `--host <host>` - MQTT broker host (default: localhost)
- `--port <port>` - MQTT broker port (default: 1883)
- `--client-id <id>` - MQTT client ID (auto-generated if not provided)
- `--username <user>` - MQTT username
- `--password <pass>` - MQTT password
- `--server-name <name>` - Server name (default: "Node MCP Server")
- `--help, -h` - Show help message

### Client Options (`node-client.ts`)

- `--host <host>` - MQTT broker host (default: localhost)
- `--port <port>` - MQTT broker port (default: 1883)
- `--client-id <id>` - MQTT client ID (auto-generated if not provided)
- `--username <user>` - MQTT username
- `--password <pass>` - MQTT password
- `--client-name <name>` - Client name (default: "Node MCP Client")
- `--help, -h` - Show help message

## Example Output

### Server Output
```
🚀 Starting MCP over MQTT Server (Node.js)...
📡 Server: Node MCP Server v1.0.0
🌐 MQTT Broker: localhost:1883
✅ Server is ready and listening for requests
📋 Request topic: mcp/servers/node-mcp-server/requests
📤 Response topic: mcp/servers/node-mcp-server/responses

Available tools:
  - system-info: Get Node.js system information
  - file-exists: Check if a file exists
  - echo: Echo back a message
  - time: Get current timestamp

Available resources:
  - process:env: Environment variables (JSON)
  - server:info: Server information (JSON)

Press Ctrl+C to stop
```

### Client Output
```
🚀 Starting MCP over MQTT Client (Node.js)...
📡 Client: Node MCP Client v1.0.0
🌐 MQTT Broker: localhost:1883
🔍 Starting server discovery...
   Make sure to start a server with: node node-server.ts
🔍 Discovered server: Node MCP Server
🔌 Connecting to server: Node MCP Server...
✅ Connected to server: Node MCP Server
📋 Listing tools for Node MCP Server...
🔧 Available tools (4):
  - system-info: Get Node.js system information
  - file-exists: Check if a file exists on the filesystem
  - echo: Echo back the input message
  - time: Get current timestamp
🧪 Testing Node.js tools on Node MCP Server...
  ✅ system-info tool: Platform: darwin, Node: v20.8.0
  ✅ file-exists tool: File "./package.json" exists
  ✅ echo tool: Echo: Hello from Node.js client!
  ✅ time tool: Current time: 2024-01-15T10:30:45.123Z
📚 Listing resources for Node MCP Server...
📄 Available resources (2):
  - process:env: Environment Variables
  - server:info: Server Information
🧪 Testing Node.js resources on Node MCP Server...
  ✅ server:info resource:
     Server: Node MCP Server v1.0.0
     Platform: darwin, Node: v20.8.0
     Uptime: 25 seconds
  ✅ process:env resource: Found 45 environment variables
     Sample: PATH exists: Yes
```

## Understanding the Examples

### Server Implementation Highlights

The server example demonstrates best practices:

```typescript
import { McpMqttServer } from '../dist/index.js'

// Constructor-based instantiation
const server = new McpMqttServer(config)

// Tool registration
server.tool(
  'echo',
  'Echo back the input message',
  {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
      },
    },
    required: ['message'],
  },
  async ({ message }) => ({
    content: [{
      type: 'text',
      text: `Echo: ${message}`,
    }],
  })
)

// Resource registration
server.resource(
  'server:info',
  'Server Information',
  async () => ({
    contents: [{
      uri: 'server:info',
      mimeType: 'application/json',
      text: JSON.stringify(serverInfo, null, 2),
    }],
  }),
  {
    description: 'Information about this MCP server',
    mimeType: 'application/json',
  }
)

await server.start()
```

### Client Implementation Highlights

The client example demonstrates discovery and interaction:

```typescript
import { McpMqttClient } from '../dist/index.js'

// Constructor-based instantiation
const client = new McpMqttClient(config)

// Server discovery handler
client.on('serverDiscovered', async (server) => {
  await client.initializeServer(server.serverId)

  // List and call tools using serverId
  const tools = await client.listTools(server.serverId)
  const result = await client.callTool(server.serverId, 'echo', {
    message: 'Hello!'
  })

  // List and read resources using serverId
  const resources = await client.listResources(server.serverId)
  const data = await client.readResource(server.serverId, 'server:info')
})

await client.connect()
```

## Development Notes

### Running TypeScript Directly

For development, you can run the TypeScript files directly using Node.js (since they have proper shebang and ES module imports):

```bash
node examples/node-server.ts
node examples/node-client.ts
```

### MQTT Broker Requirements

These examples require an MQTT broker running on the specified host and port. You can use:

- **Mosquitto** (local): `mosquitto -p 1883`
- **EMQX** (local): Docker or native installation
- **Cloud MQTT brokers**: Update host/port and add authentication

### Troubleshooting

**Client can't discover server:**
- Make sure the MQTT broker is running
- Verify both client and server use the same MQTT broker host/port
- Check that the server has started successfully

**Connection errors:**
- Verify MQTT broker is accessible
- Check authentication credentials if using username/password
- Ensure no firewall blocking the MQTT port

**Tool/Resource errors:**
- Check server logs for error details
- Verify the tool/resource names match exactly
- Ensure proper parameter types when calling tools
