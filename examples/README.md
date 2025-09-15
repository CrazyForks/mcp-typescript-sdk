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

### 2. Interactive Node.js Client (`node-client.ts`)

An interactive Node.js MCP client that demonstrates:
- Client configuration using constructor pattern (`new McpMqttClient()`)
- Automatic server discovery over MQTT
- Interactive command-line interface with help system
- Server connection and initialization
- Tool browsing, selection, and guided execution
- Resource listing and reading
- Direct command execution capabilities
- Error handling and graceful shutdown

## Running the Examples

### Basic Usage

1. **Terminal 1** - Start the server:
```bash
node examples/node-server.ts
```

2. **Terminal 2** - Run the interactive client:
```bash
node examples/node-client.ts
```

The client will automatically discover the server and enter interactive mode where you can explore and execute tools.

### With Custom Configuration

**Server with custom options:**
```bash
node examples/node-server.ts --host mqtt://localhost:1883 --server-name "My Demo Server"
```

**Client with custom options:**
```bash
node examples/node-client.ts --host mqtt://localhost:1883 --client-name "My Demo Client"
```

## Command Line Options

### Server Options (`node-server.ts`)

- `--host <host>` - MQTT broker URL (default: mqtt://localhost:1883)

- `--client-id <id>` - MQTT client ID (auto-generated if not provided)
- `--username <user>` - MQTT username
- `--password <pass>` - MQTT password
- `--server-name <name>` - Server name (default: "Node MCP Server")
- `--help, -h` - Show help message

### Client Options (`node-client.ts`)

- `--host <host>` - MQTT broker URL (default: mqtt://localhost:1883)

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
🌐 MQTT Broker: mqtt://localhost:1883
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

### Interactive Client Output
```
🚀 Starting MCP over MQTT Client (Node.js)...
📡 Client: Node MCP Client v1.0.0
🌐 MQTT Broker: mqtt://localhost:1883
🔍 Starting server discovery...
   Make sure to start a server with: node node-server.ts
🔍 Discovered server: Node MCP Server (ID: server-123)
🔌 Connecting to server: Node MCP Server...
✅ Connected to server: Node MCP Server
📋 Listing tools for Node MCP Server...
🔧 Available tools (4):
  - system-info: Get Node.js system information
  - file-exists: Check if a file exists on the filesystem
  - echo: Echo back the input message
  - time: Get current timestamp
📚 Listing resources for Node MCP Server...
📄 Available resources (2):
  - process:env: Environment Variables
  - server:info: Server Information

🎯 Interactive Mode Started!
Type "help" for available commands or "exit" to quit

MCP> help

📖 Available Commands:

  help                                   Show this help message
  servers                               List all discovered servers
  tools <server-id>                     List available tools for a server
  resources <server-id>                 List available resources for a server
  call <server-id> <tool-name> [args]   Call a tool with optional JSON arguments
  read <server-id> <resource-uri>       Read a resource
  interactive <server-id>               Start interactive tool execution for a server
  exit / quit                           Exit the client

Examples:
  servers
  tools server-123
  call server-123 echo {"message": "Hello World"}
  read server-123 server:info
  interactive server-123

MCP> interactive server-123

🎯 Interactive Tool Execution for Node MCP Server
Select a tool to execute:

  1. system-info: Get Node.js system information
  2. file-exists: Check if a file exists on the filesystem  
  3. echo: Echo back the input message
  4. time: Get current timestamp

Enter tool number (or "back" to return): 3

🔧 Selected tool: echo
📝 Description: Echo back the input message

📋 This tool requires parameters:
  message (required): The message to echo back Hello from interactive mode!

⏳ Executing tool "echo"...

✅ Tool execution completed:
Echo: Hello from interactive mode!

Execute another tool? (y/n): n

MCP> exit
👋 Goodbye!
```

## Interactive Client Commands

The interactive client provides a rich command-line interface for exploring and executing MCP servers:

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show all available commands | `help` |
| `servers` | List all discovered servers | `servers` |
| `tools <server-id>` | List tools on a server | `tools server-123` |
| `resources <server-id>` | List resources on a server | `resources server-123` |
| `call <server-id> <tool-name> [args]` | Direct tool execution | `call server-123 echo {"message": "Hello"}` |
| `read <server-id> <resource-uri>` | Read a resource | `read server-123 server:info` |
| `interactive <server-id>` | Interactive tool execution | `interactive server-123` |
| `exit` / `quit` | Exit the client | `exit` |

### Interactive Tool Execution

The `interactive <server-id>` command provides a guided interface:

1. **Tool Selection**: Browse tools with numbered menu
2. **Parameter Input**: Guided parameter collection with type validation
3. **Execution**: Run the tool and display results
4. **Continue**: Option to execute additional tools

This mode is ideal for:
- Exploring unfamiliar servers
- Testing tools with complex parameters
- Learning about available functionality
- Interactive debugging and development

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

These examples require an MQTT broker running on the specified connection URL. You can use:

- **Mosquitto** (local): `mosquitto -p 1883`
- **EMQX** (local): Docker or native installation
- **Cloud MQTT brokers**: Update connection URL and add authentication

### Troubleshooting

**Client can't discover server:**
- Make sure the MQTT broker is running
- Verify both client and server use the same MQTT broker connection URL
- Check that the server has started successfully

**Connection errors:**
- Verify MQTT broker is accessible
- Check authentication credentials if using username/password
- Ensure no firewall blocking the MQTT connection

**Tool/Resource errors:**
- Check server logs for error details
- Verify the tool/resource names match exactly
- Ensure proper parameter types when calling tools
