# MCP over MQTT SDK Examples

This directory contains example implementations showing how to use the `@emqx-ai/mcp-mqtt-sdk`.

## Available Examples

### 1. Node.js Server (`node-server.ts`)

A Node.js MCP server that demonstrates:
- Server configuration and startup
- Tool registration (echo, time, calculate)
- Resource registration (server info, status)
- Error handling and graceful shutdown

**Usage:**
```bash
# Compile TypeScript first
cd mcp-typescript-sdk
npm run build

# Run the simple server
node examples/node-server.js

# Or with custom options
node examples/node-server.js --host localhost --port 1883 --server-name "My Server"
```

### 2. Node.js Client (`node-client.ts`)

A Node.js MCP client that demonstrates:
- Client configuration and connection
- Server discovery
- Tool listing and calling
- Resource listing and reading
- Automatic testing of discovered servers

**Usage:**
```bash
# Make sure a server is running first, then:
node examples/node-client.js

# Or with custom options
node examples/node-client.js --host localhost --port 1883 --client-name "My Client"
```

## Quick Test

1. **Terminal 1** - Start the server:
```bash
node examples/node-server.js
```

2. **Terminal 2** - Run the client:
```bash
node examples/node-client.js
```

The client should automatically discover the server and test all available tools and resources.

## Example Output

**Server:**
```
🚀 Starting Simple MCP over MQTT Server...
📡 Server: Simple MCP Server v1.0.0
🌐 MQTT Broker: localhost:1883
✅ Server is ready and listening for requests
📋 Request topic: mcp/servers/simple-mcp-server/requests
📤 Response topic: mcp/servers/simple-mcp-server/responses

Available tools:
  - echo: Echo back a message
  - time: Get current timestamp  
  - calculate: Perform math calculations

Available resources:
  - server:info: Server information (JSON)
  - server:status: Server status (text)

Press Ctrl+C to stop
```

**Client:**
```
🚀 Starting Simple MCP over MQTT Client...
📡 Client: Simple MCP Client v1.0.0
🌐 MQTT Broker: localhost:1883
🔍 Starting server discovery...
🔍 Discovered server: simple-mcp-server
🔌 Connecting to server: simple-mcp-server...
✅ Connected to server: simple-mcp-server
📋 Listing tools for simple-mcp-server...
🔧 Available tools (3):
  - echo: Echo back the input message
  - time: Get current timestamp
  - calculate: Perform simple mathematical calculations
🧪 Testing tools on simple-mcp-server...
  ✅ echo tool: Echo: Hello from client!
  ✅ time tool: Current time: 2024-01-15T10:30:45.123Z
  ✅ calculate tool: 2 + 3 * 4 = 14
📚 Listing resources for simple-mcp-server...
📄 Available resources (2):
  - server:info: Server Information
  - server:status: Server Status
🧪 Testing resources on simple-mcp-server...
  ✅ server:info resource:
     Server: Simple MCP Server v1.0.0
     Uptime: 12 seconds
  ✅ server:status resource: Server "Simple MCP Server" is running
Uptime: 12 seconds
```

## Command Line Options

Both examples support the following options:

- `--host <host>`: MQTT broker host (default: localhost)
- `--port <port>`: MQTT broker port (default: 1883)
- `--client-id <id>`: MQTT client ID (auto-generated if not provided)
- `--username <user>`: MQTT username
- `--password <pass>`: MQTT password
- `--help, -h`: Show help message

Server-specific options:
- `--server-name <name>`: Server name (default: Simple MCP Server)

Client-specific options:
- `--client-name <name>`: Client name (default: Simple MCP Client)

## Development Notes

These examples are written in TypeScript and need to be compiled before running:

```bash
# In the project root
npm run build

# Then run the examples
node examples/simple-server.js
node examples/simple-client.js
```

For development, you can use `ts-node` to run them directly:

```bash
# Install ts-node if not already installed
npm install -g ts-node

# Run directly
ts-node examples/simple-server.ts
ts-node examples/simple-client.ts
```